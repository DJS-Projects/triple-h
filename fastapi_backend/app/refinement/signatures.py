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

Phase 1 scope
-------------
Only `ClassifyFragments` is exposed today. It does the cheap, high-
signal work — assigning OCR fragments to field keys — without asking
the VLM to do pixel-precise geometry. Detection (`add`) and refinement
(`move`) signatures land in Phase 2/3 once the eval harness has IoU
ground truth to score against.
"""

from __future__ import annotations

from typing import Final

import dspy

from app.refinement.schemas import ARQTrace, BBoxPatch

PROMPT_VERSION: Final[str] = "classify-fragments@v1"


class ClassifyFragments(dspy.Signature):
    """Refine an OCR scaffold by assigning fragments to field keys.

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

    Then emit `patches`: a list of `BBoxPatch` operations. For Phase 1
    only `assign` and `reject` operations are valid — do not emit
    `add` or `move`. If a field has no matching OCR fragment, omit
    the field rather than guessing geometry. The downstream extraction
    LLM owns value extraction; your job here is fragment routing.

    Self-report confidence on every patch. Filter aggressively — it is
    better to skip a low-confidence assignment than to inject a wrong
    routing that downstream trusts.
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
        "system expects."
    )

    arq_trace: ARQTrace = dspy.OutputField(
        desc="Structured reasoning checkpoints. Fill before emitting patches."
    )
    patches: list[BBoxPatch] = dspy.OutputField(
        desc="Edit operations. Phase 1: `assign` and `reject` only — never "
        "emit `add` or `move`. Skip a field rather than guessing."
    )
