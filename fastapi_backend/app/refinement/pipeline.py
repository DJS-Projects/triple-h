"""End-to-end refinement pipeline.

Loads the relevant extraction artifacts, configures DSPy against the
LiteLLM proxy, runs the Signature, applies the resulting patches, and
returns the result. Persistence is delegated to the caller (route or
service) so this module stays I/O-free relative to the database — it
only talks to the VLM.
"""

from __future__ import annotations

import io
import json
import logging
import time
from dataclasses import dataclass
from typing import Any

import dspy
from PIL import Image as PILImage

from app.config import settings
from app.refinement.apply_patches import apply_patches
from app.refinement.schemas import ARQTrace, BBoxPatch, RefinementResult
from app.refinement.signatures import PROMPT_VERSION, RefineScaffold

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


def _build_lm() -> tuple[dspy.LM, str]:
    """Construct a DSPy LM bound to our LiteLLM virtual model.

    Returns the LM plus the model id we want to record on the
    `refinement_run` row. Pinned to `openai/refinement-vlm` so swapping
    the underlying provider only requires editing `litellm/config.yaml`.
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
    return lm, model_id


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

    lm, vlm_model = _build_lm()
    # DSPy 3.x exposes Image(pil_image) directly; from_PIL is deprecated.
    pil_image = PILImage.open(io.BytesIO(page_image_bytes))
    pil_image.load()  # force-decode now so the BytesIO can be GC'd
    image = dspy.Image(pil_image)
    scaffold_blob = json.dumps(_compact_scaffold(docling_scaffold), indent=2)
    schema_blob = "\n".join(field_keys)

    predictor = dspy.Predict(RefineScaffold)

    started_ms = time.perf_counter()
    try:
        # `dspy.context` scopes the LM to this async task, unlike
        # `dspy.configure` which is single-task and errors when called
        # from a different async task than the one that initialised it.
        with dspy.context(lm=lm):
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

    token_usage = _extract_token_usage(lm)

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


def _extract_token_usage(lm: dspy.LM) -> dict[str, Any] | None:
    """Pull last-call token usage from the bound LM's history.

    Best-effort — different providers expose different shapes; we
    persist whatever is there for later analytics. Reading from the
    LM instance instead of `dspy.settings.lm` avoids the async-task
    boundary issue that bit `_configure_dspy()`.
    """
    try:
        history = getattr(lm, "history", None) or []
        if not history:
            return None
        last = history[-1]
        usage = last.get("usage", {}) or {}
        return {
            "prompt_tokens": usage.get("prompt_tokens"),
            "completion_tokens": usage.get("completion_tokens"),
            "total_tokens": usage.get("total_tokens"),
        }
    except Exception:  # noqa: BLE001 — observability best-effort
        return None
