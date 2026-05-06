"""Multimodal extraction pipeline.

PDF → (Chandra OCR ∥ pdf2image) → Pydantic AI multimodal agent → typed JSON.

LLM call routed via LiteLLM proxy (LITELLM_BASE_URL). Provider/model selection
is a virtual name from litellm/config.yaml — backend doesn't pick provider
directly; LiteLLM does fallback/retry.
"""

from __future__ import annotations

import asyncio
from io import BytesIO
from typing import Literal, TypeVar

from pdf2image import convert_from_bytes
from pydantic import BaseModel
from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.config import settings
from app.services.chandra import convert_document
from tests_eval.schemas import DeliveryOrder, Invoice, PetrolBill, WeighingBill

DocType = Literal["delivery_order", "weighing_bill", "invoice", "petrol_bill"]

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
    """Heuristic: vision-capable virtual models start with 'vision-'."""
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
) -> dict:
    """Run Chandra + pdf2image in parallel, then multimodal LLM via LiteLLM.

    Returns dict with `markdown`, `extracted` (typed schema as dict), `model_used`.
    """
    schema = _SCHEMA_BY_TYPE[doc_type]
    prompt_intro = _PROMPT_BY_TYPE[doc_type]

    chandra_task = asyncio.create_task(convert_document(pdf_bytes, filename))
    if _is_vision_model(model):
        pages_task = asyncio.create_task(_render_pages(pdf_bytes, dpi))
        chandra_result, page_pngs = await asyncio.gather(chandra_task, pages_task)
    else:
        chandra_result = await chandra_task
        page_pngs = []

    agent = _build_agent(model, schema)
    user_message: list = [
        prompt_intro,
        f"\nChandra OCR markdown:\n\n{chandra_result.markdown}",
        *page_pngs,
    ]
    run = await agent.run(user_message)

    return {
        "markdown": chandra_result.markdown,
        "page_count": chandra_result.page_count,
        "extracted": run.output.model_dump(),
        "model": model,
        "doc_type": doc_type,
    }
