"""DSPy Signatures for the refinement layer.

Each Signature class is the typed contract between caller and VLM. The
class-level docstring becomes the system prompt; field descriptions
become the per-input/output instructions; output type annotations
become the schema the VLM is forced into.

Versioning
----------
Bump `PROMPT_VERSION` whenever the docstring, field descriptions, or
output schema change. Persisted on every `refinement_run` row so audit
diffs across versions stay coherent and (later) GEPA optimization
groups runs correctly.
"""

from __future__ import annotations

from typing import Final

import dspy

from app.refinement.schemas import ARQTrace, BBoxPatch

PROMPT_VERSION: Final[str] = "refine-scaffold@v2"


class RefineScaffold(dspy.Signature):
    """Refine an OCR scaffold by routing fragments AND drawing missing bboxes.

    You are given:
      1. A page image (visual ground truth).
      2. An OCR scaffold (DoclingDocument JSON) with line-level bboxes
         and transcribed text. The OCR may be imperfect — text errors,
         missing handwriting, stamp artifacts.
      3. The target field schema — the list of dot/bracket-pathed keys
         the downstream system expects (e.g. `do_number`,
         `issuer.name`, `items[0].quantity`).

    Process — fill every reasoning field in order before producing
    patches. Each reasoning field reinstates a constraint:
      • `visual_audit` — describe what you actually see on the page.
        Do not look at the OCR scaffold yet. List five concrete cues:
        stamps, handwriting, table boundaries, header text, signatures.
      • `scaffold_match` — for each field_key, locate its visual region
        on the page (quote position: top-right, mid-page, etc) and
        report whether the OCR scaffold has a fragment in that region.
      • `discrepancies` — enumerate scaffold errors with image evidence.
        OCR text errors, missing handwriting bboxes, mislabeled fields,
        artifacts to reject.

    Then emit `patches`: a list of `BBoxPatch` operations. Four ops:

      - `assign`  — fragment_id + field_key. Bind an existing OCR
                    fragment to a field. No geometry change.
      - `reject`  — fragment_id only. Flag artifact (page numbers,
                    decorative text, OCR garbage).
      - `add`     — field_key + new_text + box_2d. Use ONLY for
                    regions OCR missed entirely (handwriting, stamps,
                    signatures). Emit `box_2d` as a list of four
                    integers in [x_min, y_min, x_max, y_max] order,
                    normalized to a 1000x1000 image space (TOPLEFT
                    origin). This matches your native bounding-box
                    output convention — emit numbers, not prose.
      - `move`    — fragment_id + box_2d. Use ONLY when an existing
                    OCR fragment has the right text but a clearly
                    wrong/cropped bbox. Same `box_2d` format as `add`.

    Confidence rules:
      • assign / reject: 1.0 acceptable when text is unambiguous.
      • add / move: be honest. 0.85+ when you can pinpoint the region
        within ~3% of page width. Lower otherwise. Patches under 0.5
        are dropped by the applier — better to skip than guess.

    Field key rules: emit only field_keys that appear in `field_schema`
    verbatim. Do not invent keys. If a field is genuinely missing from
    the page, omit it from patches rather than fabricating geometry.
    """

    page_image: dspy.Image = dspy.InputField(
        desc="Page rendered as a PNG. Use this as visual ground truth."
    )
    docling_scaffold: str = dspy.InputField(
        desc="DoclingDocument JSON serialization. Lists fragments with "
        "id, text, and bbox in PDF point space (TOPLEFT origin)."
    )
    field_schema: str = dspy.InputField(
        desc="Newline-separated list of target field keys the downstream "
        "system expects. Emit field_key values verbatim from this list."
    )

    arq_trace: ARQTrace = dspy.OutputField(
        desc="Structured reasoning checkpoints. Fill before emitting patches."
    )
    patches: list[BBoxPatch] = dspy.OutputField(
        desc="Edit operations. assign/reject for routing, add/move for "
        "geometry. Use box_2d (1000x1000 normalized, TOPLEFT, "
        "[x_min,y_min,x_max,y_max]) for add/move. Skip a field rather "
        "than guessing geometry."
    )


# Backwards-compat alias — older imports continue to resolve while the
# pipeline is migrated to the new signature name.
ClassifyFragments = RefineScaffold
