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
"""

from __future__ import annotations

import copy
from typing import Any

from app.refinement.schemas import BBoxPatch


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

    Phase 1 supports `assign` + `reject` only. `add` / `move` raise
    `NotImplementedError` so a Signature change can't silently land an
    op the applier doesn't understand.
    """

    out = copy.deepcopy(scaffold)
    out.setdefault("field_assignments", {})
    out.setdefault("rejected_fragments", [])
    out.setdefault("low_confidence_patches", [])

    fragments_by_id = _build_fragment_index(out)

    for patch in patches:
        if patch.confidence < confidence_floor:
            out["low_confidence_patches"].append(patch.model_dump())
            continue

        if patch.op == "assign":
            _apply_assign(out, patch, fragments_by_id)
        elif patch.op == "reject":
            _apply_reject(out, patch, fragments_by_id)
        elif patch.op in ("add", "move"):
            raise NotImplementedError(
                f"Patch op {patch.op!r} not supported in Phase 1; "
                "Signature should not have emitted this."
            )
        else:  # pragma: no cover — typed as Literal
            raise ValueError(f"Unknown patch op: {patch.op!r}")

    return out


# --- helpers ---------------------------------------------------------------


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
