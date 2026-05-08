"""VLM-driven refinement of OCR scaffolds.

Architecture
------------
The OCR pipeline (Chandra via datalab SDK) produces a `DoclingDocument`
with line-level bbox grounding. For handwriting, stamps, and other
visually messy regions Surya/Chandra is line-detection-limited and
emits stale bboxes, mislabels, or misses entirely.

This module wraps a Vision LLM (default: Google Gemma via LiteLLM) in
a typed DSPy Signature with ARQ-style reasoning checkpoints. The VLM
sees the page image plus the OCR scaffold and emits a typed list of
`BBoxPatch` operations: assign a fragment to a field, add a missing
bbox, reject an artifact, or move a stale bbox. The patches are then
applied as a pure function to produce a refined scaffold.

Goals
-----
- **Auditability from day one** — every call persists its inputs, raw
  reasoning trace, and structured output to `refinement_run`.
- **Traceability** — DSPy Signature class is versioned; `prompt_version`
  on the row pins each call to a code revision.
- **Observability** — token usage + duration captured per call.
- **Optimizability later** — when we have a labeled IoU eval set we
  can run `dspy.GEPA` or similar against the same Signature without
  changing the call sites.

Phasing (per current plan)
--------------------------
- Phase 1 (this commit): classification only. VLM picks which OCR
  fragment belongs to which field. No bbox edits.
- Phase 2: detection. VLM emits bboxes for handwriting fields the OCR
  missed entirely.
- Phase 3: spatial refinement. VLM moves stale bboxes — gated on a
  grounding-capable model (Qwen2.5-VL, Molmo) since most VLMs are too
  weak at pixel coords for this.
"""

from app.refinement.schemas import BBoxPatch, RefinementResult

__all__ = ["BBoxPatch", "RefinementResult"]
