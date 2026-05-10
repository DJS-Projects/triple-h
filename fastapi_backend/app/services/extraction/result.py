"""Output contract for the two-stage extraction pipeline.

The envelope mirrors the outer shape of the reference implementation
(`status` / `parsed_info` / metadata) but separates concerns the
reference flattened into one dict:

  - `parsed_info`            — merged final answer (single typed schema dump)
  - `provenance`             — per-field source trail (which stage produced it)
  - `stage_outputs`          — one entry per pipeline stage; same shape across
                               stages so they're directly diffable
  - `document_analysis`      — type detection + issuer canonicalization
  - `metadata`               — file hashes, model ids, timing, token usage

Two stages share the same `StageOutput` shape so:
  • Either stage can produce a complete answer alone (graceful degradation
    when the other fails — Chandra-only or VLM-only fallback paths).
  • Per-stage accuracy can be measured independently against ground truth
    (eval suite isolates regret/recall by source).
  • Future GEPA optimization treats each stage's `parsed_info` as a
    candidate generation; the reward function reads field-level accuracy.

The `FieldProvenance.source` enum carries enough information that the
review UI can color-code badges (regex_label = green, vlm = neutral,
vlm_overrode = orange) without re-deriving anything client-side.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.services.architecture import DocType

# Frozen + extra=forbid so envelope shapes can't drift silently. Catching
# typos at parse-time matters more here than ergonomic mutation, since
# every consumer (route, persistence, UI) reads the same contract.
_STRICT = ConfigDict(frozen=True, extra="forbid")


# ─── Per-field provenance ────────────────────────────────────────────────────


ProvenanceSource = Literal[
    "regex_label",  # tier 1 — known-label proximity match in OCR text
    "regex_table",  # tier 2 — column-header→cell match in Chandra <table>
    "regex_shape_only",  # tier 3 — pattern hit without label/header anchor
    "vlm",  # LLM extracted, no regex anchor for this field
    "vlm_verified",  # LLM emitted, regex anchor agreed
    "vlm_overrode",  # LLM emitted, regex anchor disagreed; VLM kept
    "user_override",  # human edit via PATCH endpoint (future)
    "merged",  # derived from multiple sources (e.g. items[] union)
]


class FieldProvenance(BaseModel):
    """Where one field's value came from.

    `block_id` is the Chandra block reference (e.g. `/page/0/Text/3`),
    making every `regex_*` source jumpable to a specific OCR fragment
    in the review UI. `bbox` is in pixel space matching the rendered
    page PNGs we already persist; the front-end can overlay it
    directly on the page image without coord conversion.
    """

    model_config = _STRICT

    field: str = Field(
        description="Dotted/bracketed path into parsed_info (e.g. 'items[0].weight_mt')."
    )
    value: Any = Field(
        description="The value attributed to this source. Mirrors what's in parsed_info."
    )
    source: ProvenanceSource
    block_id: str | None = None
    bbox: tuple[float, float, float, float] | None = Field(
        default=None,
        description="Pixel bbox [l, t, r, b] in the rendered page coord space.",
    )
    page: int | None = Field(default=None, description="1-indexed page number")
    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="0..1 if the source emitted one; regex_* sources are 1.0.",
    )


# ─── Stage output (same shape across both stages) ────────────────────────────


class StageOutput(BaseModel):
    """One pipeline stage's contribution.

    SAME shape across `chandra_processed` and `vlm_processed` so the two
    can be directly compared. `parsed_info` is the schema-typed dump
    (whatever pydantic model fits the doc_type); `fields_filled` lists
    keys the stage actually populated (non-None / non-empty); the rest
    of the schema sits in `missing_fields`.

    A stage is allowed to produce a partially-filled `parsed_info` —
    the merge layer handles the union. The chandra_processed stage
    typically only fills regex-anchored fields; vlm_processed fills
    the rest.
    """

    model_config = _STRICT

    parsed_info: dict[str, Any] = Field(
        description="Typed schema dump for this stage. Same key shape "
        "as the doc_type's pydantic model."
    )
    fields_filled: list[str] = Field(
        default_factory=list,
        description="Schema keys this stage populated with a non-empty value.",
    )
    missing_fields: list[str] = Field(
        default_factory=list,
        description="Schema keys this stage left empty / null.",
    )
    duration_ms: int = Field(ge=0)


# ─── Document analysis (classification + issuer matching) ────────────────────


class DocumentAnalysis(BaseModel):
    """Output of the classifier + issuer-recognition step.

    `detected_type` is the primary type the rest of the pipeline runs
    against. `detected_types` + `pages_breakdown` are populated only
    for mixed-document mode (future); single-doc runs use the
    `detected_type` field exclusively.
    """

    model_config = _STRICT

    detected_type: DocType
    detected_types: list[DocType] = Field(
        default_factory=list,
        description="Populated only in mixed-document mode (future).",
    )
    pages_breakdown: dict[int, DocType] = Field(
        default_factory=dict,
        description="Page-number → doc_type map for mixed-document mode (future).",
    )
    issuer_canonical: str | None = Field(
        default=None,
        description="Canonical company name from the registry, or null if "
        "no fuzzy match crossed the confidence threshold.",
    )


# ─── Metadata (telemetry + lineage, no domain content) ───────────────────────


class TokenUsage(BaseModel):
    """Per-call token accounting. Sums across stage 2 calls only — Chandra
    pre-pass is non-LLM and contributes nothing here."""

    model_config = _STRICT

    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


class ExtractionMetadata(BaseModel):
    """Lineage + telemetry. Stable enough to persist verbatim to the DB
    extraction_run row alongside the payload."""

    model_config = _STRICT

    file_hash_sha256: str | None = Field(
        default=None,
        description="Set when the route caller has already computed it; "
        "extraction itself doesn't recompute.",
    )
    file_id: str | None = Field(
        default=None, description="Document UUID once persisted; null pre-persistence."
    )
    page_count: int | None = None
    vlm_model: str = Field(description="LiteLLM virtual model id (e.g. 'gemma-4-31b').")
    ocr_provider: Literal["chandra"] = "chandra"
    chandra_checkpoint_id: str | None = None
    processing_time_ms: int = Field(ge=0)
    token_usage: TokenUsage | None = None


# ─── Top-level envelope ──────────────────────────────────────────────────────


ExtractionStatus = Literal["ok", "partial", "error"]


class FieldCorrectionRecord(BaseModel):
    """One audit-log entry from the post-extraction validation/correction loop.

    Mirrors `correctors.FieldCorrection` but as a pydantic model so it
    can ride inside the envelope and survive JSON round-trips. The FE
    can render a "this field was auto-corrected" badge later (deferred
    to T11).
    """

    model_config = _STRICT

    field_path: str = Field(description="FE-flattened path (e.g. 'vehicle_number[0]').")
    original_value: str
    final_value: str
    was_corrected: bool = Field(
        description="True when the LLM produced a different value that passed validation."
    )
    final_valid: bool = Field(
        description="True iff `final_value` passes the field's format validator. "
        "False on retry-exhausted fall-through (original kept)."
    )
    retries_used: int = Field(ge=0)
    error_hint: str | None = Field(
        default=None,
        description="One-line reason a correction failed (LLM declined, "
        "retries exhausted, budget exhausted, etc).",
    )


class ExtractionEnvelope(BaseModel):
    """The full extraction result returned by the pipeline.

    `status` semantics:
      • `ok`      — both stages succeeded; merged parsed_info is complete
                    or only fields legitimately absent from the document
                    are missing.
      • `partial` — one stage failed but the other produced a usable
                    answer (e.g. VLM down → regex-only response with
                    fewer filled fields). Caller should surface a soft
                    warning; not a 5xx.
      • `error`   — both stages failed or merge couldn't produce any
                    parsed_info. Route returns 502.
    """

    model_config = _STRICT

    status: ExtractionStatus
    doc_type: DocType
    parsed_info: dict[str, Any] = Field(
        description="Merged final answer. Shape matches the doc_type's "
        "pydantic model (DeliveryOrder, WeighingBill, Invoice, PetrolBill)."
    )

    provenance: list[FieldProvenance] = Field(
        default_factory=list,
        description="Per-field source trail. One entry per populated field "
        "in parsed_info. UI uses this to color-code badges and bbox overlays.",
    )
    stage_outputs: dict[str, StageOutput] = Field(
        default_factory=dict,
        description="Keyed by stage name: 'chandra_processed', 'vlm_processed'. "
        "Same schema shape across stages → directly diffable.",
    )
    corrections: list[FieldCorrectionRecord] = Field(
        default_factory=list,
        description="Audit log from the validate/correct loop. One entry per "
        "field that failed format validation, recording whether the LLM-driven "
        "retry succeeded (was_corrected + final_valid both True) or fell "
        "through to the original value. Empty when no field needed correction.",
    )
    document_analysis: DocumentAnalysis
    metadata: ExtractionMetadata
