"""Multimodal extraction pipeline.

Single-pass:
  bytes
    → Chandra `convert(mode=accurate, output_format=chunks)` (one API call)
    → DoclingDocument (canonical IR with bbox provenance)
    → multimodal LLM (markdown + page images via LiteLLM)
    → typed JSON

LLM call routed via the LiteLLM proxy (`LITELLM_BASE_URL`). Provider/model
selection is a virtual name from `litellm/config.yaml` — the backend
doesn't pick a provider directly; LiteLLM handles fallback/retry.
"""

from __future__ import annotations

import asyncio
import logging
from io import BytesIO
from typing import Any, Literal, TypeVar

from pdf2image import convert_from_bytes
from pydantic import BaseModel
from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.config import settings
from app.services.chandra_ocr import convert_bytes_with_chunks_async
from app.services.docling_adapter import chunks_to_docling_document
from tests_eval.schemas import DeliveryOrder, Invoice, PetrolBill, WeighingBill

_log = logging.getLogger(__name__)

DocType = Literal["delivery_order", "weighing_bill", "invoice", "petrol_bill"]

# Vision providers cap how many images per request:
#   Groq Llama-4-Scout: 5
#   NVIDIA NIM Llama-3.2-90B-Vision: 1
# Cap conservatively so the primary model always works; multi-page docs lean
# on the markdown view (still complete) for context beyond the first pages.
_MAX_IMAGES_PER_REQUEST = 5

_SCHEMA_BY_TYPE: dict[DocType, type[BaseModel]] = {
    "delivery_order": DeliveryOrder,
    "weighing_bill": WeighingBill,
    "invoice": Invoice,
    "petrol_bill": PetrolBill,
}

_PROMPT_BY_TYPE: dict[DocType, str] = {
    "delivery_order": (
        "Extract the delivery order. Cross-reference OCR markdown with the page "
        "image — prefer visual ground truth where they disagree. Pay attention to: "
        "issuer letterhead, sold-to/delivered-to blocks, DO/PO numbers, dates, "
        "vehicle plates, line items table, and totals."
    ),
    "weighing_bill": (
        "Extract the weighing bill. Capture all weights (gross, tare, net), "
        "vehicle/contract/weighing numbers, material name, timestamps, and parties."
    ),
    "invoice": (
        "Extract the invoice. Capture invoice number/date, billing party with "
        "TIN/address, supplier company with TIN, line items with quantity/unit "
        "price/amount."
    ),
    "petrol_bill": (
        "Extract the petrol receipt. Capture station details, vehicle plate, "
        "fuel type, litres, unit price, total, datetime, receipt number."
    ),
}

T = TypeVar("T", bound=BaseModel)


def _build_agent(virtual_model: str, output_type: type[T]) -> Agent[None, T]:
    model = OpenAIChatModel(
        virtual_model,
        provider=OpenAIProvider(
            base_url=settings.LITELLM_BASE_URL,
            api_key=settings.LITELLM_MASTER_KEY,
        ),
    )
    # PromptedOutput: schema embedded in prompt, parsed client-side.
    # Avoids provider-side strict tool-call validators (e.g. Groq) that
    # reject scalar/list shape mismatches the model would otherwise return.
    return Agent(model, output_type=PromptedOutput(output_type))


def _is_vision_model(model_name: str) -> bool:
    return model_name.startswith("vision-")


async def _render_pages(pdf_bytes: bytes, dpi: int) -> list[BinaryContent]:
    images = await asyncio.to_thread(convert_from_bytes, pdf_bytes, dpi=dpi)
    out: list[BinaryContent] = []
    for img in images:
        buf = BytesIO()
        img.save(buf, format="PNG")
        out.append(BinaryContent(data=buf.getvalue(), media_type="image/png"))
    return out


async def extract_structured(
    pdf_bytes: bytes,
    filename: str,
    *,
    doc_type: DocType,
    model: str = "vision-primary",
    dpi: int = 150,
) -> dict[str, Any]:
    """One Chandra call + (optional) page images → multimodal LLM → typed JSON.

    Returns:
        {
          "doc_type":       requested type,
          "model":          LiteLLM virtual model used,
          "page_count":     total pages,
          "extracted":      typed schema instance dumped to dict,
          "markdown":       Chandra-derived markdown (LLM-friendly view),
          "docling_doc":    canonical DoclingDocument as dict,
          "checkpoint_id":  Chandra checkpoint id (None if save failed),
        }
    """
    schema = _SCHEMA_BY_TYPE[doc_type]
    prompt_intro = _PROMPT_BY_TYPE[doc_type]

    chandra_task = asyncio.create_task(
        convert_bytes_with_chunks_async(pdf_bytes, filename)
    )
    if _is_vision_model(model):
        pages_task = asyncio.create_task(_render_pages(pdf_bytes, dpi))
        chandra_result, page_pngs = await asyncio.gather(chandra_task, pages_task)
    else:
        chandra_result = await chandra_task
        page_pngs = []

    if not chandra_result.success:
        raise RuntimeError(f"Chandra convert failed: {chandra_result.error}")

    docling_doc = chunks_to_docling_document(
        chandra_result.chunks,
        name=filename,
        page_count=chandra_result.page_count,
    )
    docling_dict = docling_doc.export_to_dict(
        mode="json", exclude_none=True, coord_precision=2
    )
    # Chunks mode does not populate the SDK's `.markdown` field; derive an
    # LLM-friendly view from the DoclingDocument so we keep one source of truth.
    markdown_view = docling_doc.export_to_markdown()

    agent = _build_agent(model, schema)
    capped_pngs = page_pngs[:_MAX_IMAGES_PER_REQUEST]
    if len(page_pngs) > len(capped_pngs):
        _log.info(
            "Capping %d page images to %d (provider image limit)",
            len(page_pngs),
            len(capped_pngs),
        )
    user_message: list = [
        prompt_intro,
        f"\nOCR markdown (derived from DoclingDocument; full document text):\n\n{markdown_view}",
        *capped_pngs,
    ]
    run = await agent.run(user_message)

    return {
        "doc_type": doc_type,
        "model": model,
        "page_count": chandra_result.page_count,
        "extracted": run.output.model_dump(),
        "markdown": markdown_view,
        "docling_doc": docling_dict,
        "checkpoint_id": chandra_result.checkpoint_id,
    }
