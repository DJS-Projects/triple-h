"""Per-doc-type ARQ-augmented extraction schemas.

Each `*ARQ` model wraps the corresponding schema from
`tests_eval/schemas.py` with three leading reasoning slots that fire
*before* the typed `extracted` payload. Field declaration order is
load-bearing: pydantic-ai's `PromptedOutput` respects it, and an
autoregressive LLM completes fields in declaration order, so the
reasoning slots are filled-and-attended-to immediately before the
schema-coerced output. This is the recency effect Karov, Zohar &
Marcovitz (2025, arxiv 2503.03669) argue is the mechanism behind
ARQ's instruction-adherence gains over free-form CoT.

The three leading slots map to the paper's three ARQ functions
(§4 step 1):

  1. `visual_audit`  — reinstate contextual information. Force the
     model to enumerate page cues *before* consulting OCR. Reduces
     scaffold-bias hallucinations where the model trusts OCR text
     even when the image disagrees.

  2. `field_grounding` — reinstate critical instructions. For each
     schema field, the model commits to a visual region or marks
     "NOT PRESENT". Pre-validated regex anchors handed in via the
     prompt are confirmed verbatim. Low-confidence shape-only
     candidates accepted/rejected with evidence.

  3. `id_code_audit` — facilitate intermediate reasoning. The model
     enumerates ambiguous OCR characters in reference codes
     (S↔5, l↔1, etc) and *flags* them — but does NOT correct.
     Correction is deterministic and runs in `preprocess.py` once
     the value has been anchored. Splitting flag-vs-correct keeps
     the LLM doing what only it can (visual disambiguation) and
     the deterministic layer doing what only it can (rule-based
     substitution).

Note on schema construction: the leading slots are declared as plain
str fields (not BaseModel sub-objects). The paper's design uses
JSON-shaped reasoning blueprints with nested keys; we keep them flat
strings here because (a) pydantic-ai's PromptedOutput renders nested
schemas as nested JSON in the prompt — extra tokens for no gain at
this level of structure, (b) the existing stage-2 ARQTrace also uses
flat str fields and we want shape consistency.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from tests_eval.schemas import DeliveryOrder, Invoice, PetrolBill, WeighingBill

# Order-stable, extra-forbid: schema drift caught at parse time, and the
# field declaration order — which the LLM follows during autoregressive
# decoding — is the load-bearing recency-anchor for ARQ.
_STRICT = ConfigDict(extra="forbid")


# ─── Shared leading-slot field descriptors ───────────────────────────────────


def _visual_audit_field() -> Any:
    """First ARQ slot: page cues without OCR consultation.

    The "without consulting OCR" framing is intentional — paper §4.1
    flags scaffold-bias as a frequent failure mode. The model that's
    been shown both an image and OCR text tends to trust the OCR even
    when the image clearly disagrees. Forcing five concrete cues from
    the image alone breaks the bias before extraction begins.
    """
    return Field(
        description=(
            "List five concrete cues you can see on the page WITHOUT "
            "consulting the OCR markdown. Examples: issuer letterhead, "
            "stamps or signatures, table boundaries, handwriting "
            "regions, vehicle plates visible in photos. Be specific "
            "about position (top-left, mid-page, etc)."
        )
    )


def _field_grounding_field() -> Any:
    """Second ARQ slot: per-field visual region or NOT PRESENT.

    Pre-validated anchors and shape-only candidates are passed in via
    the prompt body. The model's job here is to:
      • Confirm anchors verbatim (do NOT modify their values).
      • For each remaining schema field, locate its visual region or
        mark NOT PRESENT.
      • For shape-only candidates: accept / reject with evidence.

    Marking NOT PRESENT is the anti-hallucination lever — the model
    must explicitly opt out of inventing a value rather than silently
    fabricating one.
    """
    return Field(
        description=(
            "For each schema field listed below: locate its visual "
            "region (e.g. 'top-right corner', 'first column of items "
            "table') OR mark 'NOT PRESENT' if the field is genuinely "
            "absent from the document. Confirm pre-validated anchors "
            "verbatim — do not modify their values. For shape-only "
            "candidates, accept or reject each with one-line visual "
            "evidence. Do NOT invent values to fill missing fields."
        )
    )


def _id_code_audit_field() -> Any:
    """Third ARQ slot: ambiguous-char audit on reference codes.

    Critical: this slot FLAGS only. The actual character substitution
    (S→5, l→1, I→1, O→0, B→8, Z→2, G→6) runs deterministically in
    `preprocess.correct_id_chars` once the value has a date anchor.
    Asking the LLM to do the substitution itself is wasted compute and
    non-deterministic — the prompt template in the reference repo
    spends ~30 lines on this and still gets it wrong sometimes.
    """
    return Field(
        description=(
            "For each reference code in the extracted output (D/O "
            "number, P/O number, vehicle number, weighing number, "
            "etc), list any positions containing OCR-ambiguous "
            "characters (S vs 5, l/I vs 1, O vs 0, B vs 8, Z vs 2, "
            "G vs 6, / vs 1 in vehicle plate numbers). Flag "
            "positions only — do NOT correct them in "
            "the extracted payload. Format: 'po_number[3]: S could "
            "be 5'. If no ambiguities, write 'none'."
        )
    )


# ─── Per-doc-type ARQ wrappers ───────────────────────────────────────────────


class DeliveryOrderARQ(BaseModel):
    """ARQ-augmented delivery-order extraction.

    Field order is the contract: visual_audit → field_grounding →
    id_code_audit → extracted. The pydantic-ai Agent receives this
    schema and the LLM completes fields in this order.
    """

    model_config = _STRICT

    visual_audit: str = _visual_audit_field()
    field_grounding: str = _field_grounding_field()
    id_code_audit: str = _id_code_audit_field()
    extracted: DeliveryOrder


class WeighingBillARQ(BaseModel):
    """ARQ-augmented weighing-bill extraction."""

    model_config = _STRICT

    visual_audit: str = _visual_audit_field()
    field_grounding: str = _field_grounding_field()
    id_code_audit: str = _id_code_audit_field()
    extracted: WeighingBill


class InvoiceARQ(BaseModel):
    """ARQ-augmented invoice extraction."""

    model_config = _STRICT

    visual_audit: str = _visual_audit_field()
    field_grounding: str = _field_grounding_field()
    id_code_audit: str = _id_code_audit_field()
    extracted: Invoice


class PetrolBillARQ(BaseModel):
    """ARQ-augmented petrol-bill extraction."""

    model_config = _STRICT

    visual_audit: str = _visual_audit_field()
    field_grounding: str = _field_grounding_field()
    id_code_audit: str = _id_code_audit_field()
    extracted: PetrolBill


# ─── Doc-type → ARQ wrapper lookup ───────────────────────────────────────────

ARQ_BY_DOC_TYPE: dict[str, type[BaseModel]] = {
    "delivery_order": DeliveryOrderARQ,
    "weighing_bill": WeighingBillARQ,
    "invoice": InvoiceARQ,
    "petrol_bill": PetrolBillARQ,
}
