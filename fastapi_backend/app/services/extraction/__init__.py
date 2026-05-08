"""Extraction pipeline package.

Stage 1 (current entrypoint, single-pass):
  PDF bytes
    → Chandra OCR (chunks mode)
    → DoclingDocument
    → multimodal LLM via LiteLLM
    → typed JSON

Stage 2 (in-progress, ARQ-augmented two-stage with provenance):
  PDF bytes
    → Chandra OCR
    → preprocess + Tier-1/Tier-2 anchor extraction (deterministic)
    → ARQ-augmented LLM pass (residual extraction + anchor verification)
    → merge + postprocess + consistency validators
    → ExtractionEnvelope with per-field provenance

`pipeline.extract_structured` is the legacy single-pass entrypoint and
the current production path. New code lives alongside it under this
package and will replace it once the envelope contract lands and eval
shows the two-stage approach matches or beats baseline.
"""

from __future__ import annotations

from app.services.extraction.pipeline import (
    ExtractionPipelineResult,
    RenderedPage,
    extract_structured,
)

__all__ = [
    "ExtractionPipelineResult",
    "RenderedPage",
    "extract_structured",
]
