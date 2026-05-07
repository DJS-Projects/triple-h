"""Pure patch application: (scaffold, patches) → patched_scaffold.

Kept separate from the pipeline so it stays trivially testable. No I/O,
no LLM, no clock; just a function over JSON-shaped DoclingDocument
dicts and a list of `BBoxPatch` models.

Scaffold shape
--------------
We don't deserialize into the docling-core pydantic types here — that
schema is large and we only touch a small surface. We treat the
scaffold as a dict matching the Docling JSON layout:

    {
      "pages": {"1": {"size": {"width": 595.44, "height": 842.04}, ...}},
      "texts": [
        {
          "self_ref": "#/texts/0",
          "text": "...",
          "prov": [{"bbox": {"l":..,"t":..,"r":..,"b":..}, ...}],
          ...
        },
        ...
      ],
      ...
    }

A `field_assignments` map is added at the top level (not part of
Docling's official schema, but downstream code reads it for the KVP
view). `rejected_fragments` list captures `reject` ops; the fragment
itself stays on the scaffold so audit tooling can replay decisions.
`added_fragments` list captures `add` ops — fresh entries appended to
`texts` plus a parallel record so the audit knows they came from the
VLM, not OCR.
"""

from __future__ import annotations

import copy
from typing import Any

from app.refinement.coords import gemma_box_to_bbox
from app.refinement.schemas import BBox, BBoxPatch


def apply_patches(
    scaffold: dict[str, Any],
    patches: list[BBoxPatch],
    *,
    confidence_floor: float = 0.5,
) -> dict[str, Any]:
    """Return a new scaffold with `patches` applied.

    Pure function: the input scaffold is not mutated. Patches with
    confidence below `confidence_floor` are recorded in
    `low_confidence_patches` for audit but NOT applied.

    Supported ops:
      • `assign` — bind existing fragment to field key
      • `reject` — flag fragment as artifact
      • `add`    — append a brand new fragment with bbox + text
      • `move`   — replace bbox of an existing fragment
    """

    out = copy.deepcopy(scaffold)
    out.setdefault("field_assignments", {})
    out.setdefault("rejected_fragments", [])
    out.setdefault("added_fragments", [])
    out.setdefault("low_confidence_patches", [])

    page_w, page_h = _page_dims(out)
    fragments_by_id = _build_fragment_index(out)

    for patch in patches:
        if patch.confidence < confidence_floor:
            out["low_confidence_patches"].append(patch.model_dump())
            continue

        if patch.op == "assign":
            _apply_assign(out, patch, fragments_by_id)
        elif patch.op == "reject":
            _apply_reject(out, patch, fragments_by_id)
        elif patch.op == "add":
            _apply_add(out, patch, page_w=page_w, page_h=page_h)
        elif patch.op == "move":
            _apply_move(
                out,
                patch,
                fragments_by_id,
                page_w=page_w,
                page_h=page_h,
            )
        else:  # pragma: no cover — typed as Literal
            raise ValueError(f"Unknown patch op: {patch.op!r}")

    return out


# --- helpers ---------------------------------------------------------------


def _page_dims(scaffold: dict[str, Any]) -> tuple[float, float]:
    """Pull the first page's PDF-point dimensions out of the scaffold.

    Falls back to A4 (595.44 × 842.04) when missing — Gemma defaults to
    the same aspect ratio anyway and conversion is linear, so a wrong
    fallback only matters if the doc is non-A4.
    """
    pages = scaffold.get("pages") or {}
    for _key, page in pages.items():
        if isinstance(page, dict):
            size = page.get("size") or {}
            w = size.get("width")
            h = size.get("height")
            if w and h:
                return float(w), float(h)
            break
    return 595.44, 842.04


def _resolve_bbox(patch: BBoxPatch, *, page_w: float, page_h: float) -> BBox:
    """Pick the right bbox source on the patch.

    `box_2d` (Gemma normalised) wins over `new_bbox` (already in PDF
    points) because the VLM emits the former natively and we want the
    applier to be the single conversion site. Raise when neither is
    set since it's a Signature contract violation.
    """
    if patch.box_2d is not None:
        return gemma_box_to_bbox(patch.box_2d, page_w=page_w, page_h=page_h)
    if patch.new_bbox is not None:
        return patch.new_bbox
    raise ValueError(
        f"{patch.op} requires box_2d or new_bbox; Signature contract violated."
    )


def _build_fragment_index(scaffold: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Index fragments by `self_ref` (Docling's stable id) and any
    bare numeric id we may have synthesized."""

    out: dict[str, dict[str, Any]] = {}
    for i, frag in enumerate(scaffold.get("texts", [])):
        if isinstance(frag, dict):
            ref = frag.get("self_ref") or frag.get("id") or f"f{i}"
            out[ref] = frag
            # also accept "f{i}" form used by sandbox / tests
            out[f"f{i}"] = frag
    return out


def _apply_assign(
    scaffold: dict[str, Any],
    patch: BBoxPatch,
    fragments_by_id: dict[str, dict[str, Any]],
) -> None:
    if not patch.fragment_id or not patch.field_key:
        raise ValueError(
            "assign requires both fragment_id and field_key; "
            "Signature contract violated."
        )
    if patch.fragment_id not in fragments_by_id:
        # Don't crash — record the orphan and move on. Useful when VLM
        # references a fragment id that doesn't exist on the scaffold.
        scaffold.setdefault("orphan_patches", []).append(patch.model_dump())
        return
    scaffold["field_assignments"][patch.field_key] = {
        "fragment_id": patch.fragment_id,
        "confidence": patch.confidence,
        "reason": patch.reason,
    }


def _apply_reject(
    scaffold: dict[str, Any],
    patch: BBoxPatch,
    fragments_by_id: dict[str, dict[str, Any]],
) -> None:
    if not patch.fragment_id:
        raise ValueError("reject requires fragment_id; Signature contract violated.")
    if patch.fragment_id not in fragments_by_id:
        scaffold.setdefault("orphan_patches", []).append(patch.model_dump())
        return
    scaffold["rejected_fragments"].append(
        {
            "fragment_id": patch.fragment_id,
            "confidence": patch.confidence,
            "reason": patch.reason,
        }
    )


def _apply_add(
    scaffold: dict[str, Any],
    patch: BBoxPatch,
    *,
    page_w: float,
    page_h: float,
) -> None:
    """Append a brand-new fragment to `texts[]` with a fresh `self_ref`.

    The new fragment is namespaced as `#/refined-texts/{n}` so audit
    tooling can tell at-a-glance which fragments came from OCR vs the
    VLM. Same shape as Docling's native fragments — `prov[0].bbox` is
    populated so the frontend overlay treats it identically.
    """
    if not patch.new_text:
        raise ValueError("add requires new_text; Signature contract violated.")
    bbox = _resolve_bbox(patch, page_w=page_w, page_h=page_h)
    refined = scaffold.setdefault("refined_texts", [])
    new_ref = f"#/refined-texts/{len(refined)}"
    fragment = {
        "self_ref": new_ref,
        "text": patch.new_text,
        "prov": [{"bbox": bbox.model_dump(), "page_no": 1}],
        "source": "vlm",
        "confidence": patch.confidence,
    }
    refined.append(fragment)
    # Mirror onto the shared `texts[]` so consumers that iterate the
    # canonical Docling field still see the new fragment.
    scaffold.setdefault("texts", []).append(fragment)
    scaffold["added_fragments"].append(
        {
            "fragment_id": new_ref,
            "field_key": patch.field_key,
            "text": patch.new_text,
            "bbox": bbox.model_dump(),
            "confidence": patch.confidence,
            "reason": patch.reason,
        }
    )
    if patch.field_key:
        scaffold["field_assignments"][patch.field_key] = {
            "fragment_id": new_ref,
            "confidence": patch.confidence,
            "reason": patch.reason,
        }


def _apply_move(
    scaffold: dict[str, Any],
    patch: BBoxPatch,
    fragments_by_id: dict[str, dict[str, Any]],
    *,
    page_w: float,
    page_h: float,
) -> None:
    """Replace the `prov[0].bbox` of an existing fragment.

    Records the prior bbox in `bbox_history` so audit tooling can
    replay or reverse the move.
    """
    if not patch.fragment_id:
        raise ValueError("move requires fragment_id; Signature contract violated.")
    if patch.fragment_id not in fragments_by_id:
        scaffold.setdefault("orphan_patches", []).append(patch.model_dump())
        return
    bbox = _resolve_bbox(patch, page_w=page_w, page_h=page_h)
    fragment = fragments_by_id[patch.fragment_id]
    prov = fragment.setdefault("prov", [{}])
    if not prov:
        prov.append({})
    prior_bbox = prov[0].get("bbox")
    prov[0]["bbox"] = bbox.model_dump()
    scaffold.setdefault("bbox_history", []).append(
        {
            "fragment_id": patch.fragment_id,
            "before": prior_bbox,
            "after": bbox.model_dump(),
            "confidence": patch.confidence,
            "reason": patch.reason,
        }
    )
