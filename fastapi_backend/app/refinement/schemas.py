"""Typed I/O for the refinement layer.

Pydantic models here are the source of truth for both:
  - the DSPy Signature output schema (forces structured VLM output)
  - the database `patches` JSONB column on `refinement_run`
  - any HTTP response that surfaces refinement results

Keep them small, frozen, and free of behaviour. Logic belongs in
`app/refinement/apply_patches.py` and `app/refinement/pipeline.py`.
"""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BBox(BaseModel):
    """4-point axis-aligned bbox in PDF point space (TOPLEFT origin).

    We standardise on PDF points + TOPLEFT here because every other
    layer in the pipeline (Docling, our converter, the frontend) does
    the same. The Docling source data is BOTTOMLEFT; conversion happens
    once at ingest, not at refinement time.
    """

    # Single-letter attribute names mirror the Docling JSON convention
    # so we can `model_dump()` straight into the `prov[].bbox` shape the
    # rest of the pipeline expects. Ruff's "ambiguous name" rule is
    # silenced per-line for the same reason.
    model_config = ConfigDict(frozen=True, extra="forbid")

    l: float = Field(description="Left edge in PDF points")  # noqa: E741
    t: float = Field(description="Top edge in PDF points (TOPLEFT origin)")
    r: float = Field(description="Right edge in PDF points")
    b: float = Field(description="Bottom edge in PDF points")


PatchOp = Literal["assign", "add", "reject", "move"]


class BBoxPatch(BaseModel):
    """A single edit operation against a DoclingDocument scaffold.

    Operations
    ----------
    - `assign`  — bind an existing fragment to a field key. No geometry change.
    - `add`     — introduce a new fragment with a fresh bbox + text.
                  Used when OCR missed a region (handwriting, stamps).
    - `reject`  — flag an existing fragment as artifact. The fragment
                  is kept on the scaffold for audit but excluded from
                  the rendered text layer + field assignments.
    - `move`    — replace the bbox of an existing fragment. Used to
                  fix off-by-N OCR cropping on noisy regions.

    All operations carry `reason` (free-form, ARQ-grounded) and
    `confidence` ∈ [0,1] so downstream code can drop low-confidence
    edits or surface them for human review.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    op: PatchOp = Field(description="Operation type")
    fragment_id: str | None = Field(
        default=None,
        description="Target fragment for assign/reject/move. Required for those ops.",
    )
    field_key: str | None = Field(
        default=None,
        description="Target field key for assign/add. Uses dot/bracket "
        "paths (issuer.name, items[0].quantity).",
    )
    new_bbox: BBox | None = Field(
        default=None,
        description="New bbox for add/move in PDF point space (TOPLEFT). "
        "Either populate this directly OR populate `box_2d` and let the "
        "applier convert. `box_2d` takes precedence when both are set.",
    )
    box_2d: list[int] | None = Field(
        default=None,
        description="Gemma-style bbox in 1000x1000 normalized image space "
        "(TOPLEFT origin), [x_min, y_min, x_max, y_max]. Converted to "
        "PDF points by the applier. Use this directly from VLM output "
        "instead of pre-converting on the model side.",
    )
    new_text: str | None = Field(
        default=None,
        description="Transcribed text for add. Required for add op.",
    )
    reason: str = Field(
        description="Human-readable justification grounded in visual evidence."
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Self-reported confidence; downstream may filter on this.",
    )


class ARQTrace(BaseModel):
    """Structured reasoning trace from the VLM Signature.

    Persisted verbatim to `refinement_run.arq_trace` so prompt-version
    drift can be diffed in audit UI.

    All three reasoning fields normalise to `str`. Some VLMs (Gemma in
    particular) return dict-shaped output for fields whose description
    sounds list-like — we coerce those to JSON strings so the storage
    contract stays single-typed without losing the structure.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    visual_audit: str = Field(
        description="Free-form description of what the VLM sees on the page, "
        "no reference to the OCR scaffold."
    )
    scaffold_match: str = Field(
        description="Per-field grounding: which visual region matches each "
        "field key, and whether the OCR scaffold has a fragment in that region."
    )
    discrepancies: str = Field(
        description="OCR errors enumerated: missing fields, mislabels, stale "
        "bboxes, artifacts. Each item quotes evidence from the image."
    )

    @field_validator("visual_audit", "scaffold_match", "discrepancies", mode="before")
    @classmethod
    def _coerce_to_string(cls, value: Any) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, (dict, list)):
            return json.dumps(value, indent=2, ensure_ascii=False)
        return str(value)


class RefinementResult(BaseModel):
    """Full output of one refinement pass — what gets persisted."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    arq_trace: ARQTrace
    patches: list[BBoxPatch]
