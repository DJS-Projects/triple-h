"""End-to-end refinement pipeline.

Loads the relevant extraction artifacts, configures DSPy against the
LiteLLM proxy, runs the Signature, applies the resulting patches, and
returns the result. Persistence is delegated to the caller (route or
service) so this module stays I/O-free relative to the database — it
only talks to the VLM.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any

import dspy

from app.config import settings
from app.refinement.apply_patches import apply_patches
from app.refinement.schemas import ARQTrace, BBoxPatch, RefinementResult
from app.refinement.signatures import PROMPT_VERSION, ClassifyFragments

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RefinementOutcome:
    """Everything the persistence layer needs from one call."""

    result: RefinementResult
    scaffold_in: dict[str, Any]
    scaffold_out: dict[str, Any]
    vlm_model: str
    prompt_version: str
    duration_ms: int
    token_usage: dict[str, Any] | None


def _configure_dspy() -> str:
    """Wire DSPy to the LiteLLM proxy on every call.

    Cheap idempotent op — DSPy's `configure` swaps the active LM. We
    pin to the `refinement-vlm` virtual model so swapping the
    underlying provider only requires editing `litellm/config.yaml`.
    """

    base_url = settings.LITELLM_BASE_URL
    api_key = settings.LITELLM_MASTER_KEY or "sk-litellm-local"
    model_id = "openai/refinement-vlm"

    lm = dspy.LM(
        model_id,
        api_base=base_url,
        api_key=api_key,
        temperature=0.0,
    )
    dspy.configure(lm=lm)
    return model_id


def refine_scaffold(
    *,
    page_image_bytes: bytes,
    docling_scaffold: dict[str, Any],
    field_keys: list[str],
) -> RefinementOutcome:
    """Run one refinement pass over a scaffold + page image.

    Caller is expected to:
      1. Hand in the existing DoclingDocument JSON for one page.
      2. Hand in the rendered PNG bytes for that same page.
      3. Hand in the target field keys for the current doc_type.

    Returns a `RefinementOutcome` ready for the persistence layer to
    write to `refinement_run`.
    """

    vlm_model = _configure_dspy()
    image = dspy.Image.from_bytes(page_image_bytes, mime_type="image/png")
    scaffold_blob = json.dumps(_compact_scaffold(docling_scaffold), indent=2)
    schema_blob = "\n".join(field_keys)

    predictor = dspy.Predict(ClassifyFragments)

    started_ms = time.perf_counter()
    try:
        prediction = predictor(
            page_image=image,
            docling_scaffold=scaffold_blob,
            field_schema=schema_blob,
        )
    except Exception:
        logger.exception("VLM refinement call failed")
        raise
    duration_ms = int((time.perf_counter() - started_ms) * 1000)

    arq = _coerce_arq(prediction.arq_trace)
    patches = _coerce_patches(prediction.patches)

    result = RefinementResult(arq_trace=arq, patches=patches)
    scaffold_out = apply_patches(docling_scaffold, patches)

    token_usage = _extract_token_usage()

    return RefinementOutcome(
        result=result,
        scaffold_in=docling_scaffold,
        scaffold_out=scaffold_out,
        vlm_model=vlm_model,
        prompt_version=PROMPT_VERSION,
        duration_ms=duration_ms,
        token_usage=token_usage,
    )


# --- helpers ---------------------------------------------------------------


def _compact_scaffold(scaffold: dict[str, Any]) -> dict[str, Any]:
    """Trim the DoclingDocument down to just what the VLM needs.

    Sending the full DoclingDocument into the prompt blows token cost.
    Keep only `texts` (id, text, bbox) and a small page header. Other
    fields (tables, layout, key-value maps) can be re-introduced once
    Phase 2/3 signatures need them.
    """

    texts = scaffold.get("texts", [])
    compact_texts = []
    for i, frag in enumerate(texts):
        if not isinstance(frag, dict):
            continue
        prov = frag.get("prov") or []
        bbox = prov[0].get("bbox") if prov and isinstance(prov[0], dict) else None
        compact_texts.append(
            {
                "id": frag.get("self_ref") or f"f{i}",
                "text": frag.get("text", ""),
                "bbox": bbox,
            }
        )

    pages = scaffold.get("pages", {})
    return {
        "pages": pages,
        "texts": compact_texts,
    }


def _coerce_arq(value: Any) -> ARQTrace:
    """DSPy returns Pydantic models when typed; coerce defensively in case
    the LM returned plain dict (some providers strip schema)."""
    if isinstance(value, ARQTrace):
        return value
    if isinstance(value, dict):
        return ARQTrace.model_validate(value)
    raise TypeError(f"unexpected arq_trace type: {type(value)!r}")


def _coerce_patches(value: Any) -> list[BBoxPatch]:
    if isinstance(value, list):
        return [
            v if isinstance(v, BBoxPatch) else BBoxPatch.model_validate(v)
            for v in value
        ]
    raise TypeError(f"unexpected patches type: {type(value)!r}")


def _extract_token_usage() -> dict[str, Any] | None:
    """Pull last-call token usage from DSPy's history. Best-effort —
    different providers expose different shapes; we persist whatever
    is there for later analytics."""
    try:
        history = dspy.settings.lm.history if dspy.settings.lm else []
        if not history:
            return None
        last = history[-1]
        return {
            "prompt_tokens": last.get("usage", {}).get("prompt_tokens"),
            "completion_tokens": last.get("usage", {}).get("completion_tokens"),
            "total_tokens": last.get("usage", {}).get("total_tokens"),
        }
    except Exception:  # noqa: BLE001 — observability best-effort
        return None
