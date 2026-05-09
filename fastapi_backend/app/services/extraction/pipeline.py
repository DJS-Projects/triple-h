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
import time
from dataclasses import dataclass
from io import BytesIO
from typing import Any, TypeVar

from opentelemetry import trace
from pdf2image import convert_from_bytes
from pydantic import BaseModel
from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.config import settings
from app.services.architecture import (
    DoclingArchitecture,
    DocType,
    default_architecture,
)
from tests_eval.schemas import DeliveryOrder, Invoice, PetrolBill, WeighingBill

_log = logging.getLogger(__name__)
_tracer = trace.get_tracer(__name__)

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


@dataclass(frozen=True)
class RenderedPage:
    """One PDF page rasterised to PNG bytes plus its pixel size."""

    page_no: int  # 1-indexed
    width_px: int
    height_px: int
    png_bytes: bytes


@dataclass
class ExtractionPipelineResult:
    """Everything the route + persistence layer need from one pipeline run."""

    doc_type: DocType
    model: str
    page_count: int | None
    extracted: dict[str, Any]
    markdown: str
    docling_doc: dict[str, Any]
    chandra_chunks: dict[str, Any] | None
    checkpoint_id: str | None
    duration_ms: int
    pages: list[RenderedPage]


async def _render_pages(pdf_bytes: bytes, dpi: int) -> list[RenderedPage]:
    images = await asyncio.to_thread(convert_from_bytes, pdf_bytes, dpi=dpi)
    out: list[RenderedPage] = []
    for idx, img in enumerate(images, start=1):
        buf = BytesIO()
        img.save(buf, format="PNG")
        out.append(
            RenderedPage(
                page_no=idx,
                width_px=img.width,
                height_px=img.height,
                png_bytes=buf.getvalue(),
            )
        )
    return out


async def extract_structured(
    pdf_bytes: bytes,
    filename: str,
    *,
    doc_type: DocType | None = None,
    model: str = "ollama-gemma4-31b",
    dpi: int = 150,
    architecture: DoclingArchitecture | None = None,
) -> ExtractionPipelineResult:
    """One extractor call + page render + LLM call → typed result.

    `doc_type=None` triggers the architecture's classifier first; passing
    a label explicitly bypasses classification (test fixtures, known docs).
    Pages are always rendered regardless of LLM choice so the persistence
    layer can cache them for the review UI; the LLM only receives images
    when the model is vision-capable.
    """
    arch = architecture or default_architecture()

    # Outer span covers the entire pipeline. Inner spans (chandra OCR,
    # page render, LLM) hang off this so a single trace captures the
    # whole request — easy to spot the dominant stage in flame graphs.
    with _tracer.start_as_current_span("extract_structured") as root_span:
        overall_start = time.perf_counter()

        if doc_type is None:
            # Classifier is a single small vision call (~1s). Sequential
            # because the schema/prompt selected here gates the parallel
            # extraction + render fan-out below.
            with _tracer.start_as_current_span("classify"):
                doc_type = await arch.classify(pdf_bytes, filename)

        root_span.set_attribute("doc_type", doc_type)
        root_span.set_attribute("model", model)
        root_span.set_attribute("dpi", dpi)

        schema = _SCHEMA_BY_TYPE[doc_type]
        prompt_intro = _PROMPT_BY_TYPE[doc_type]

        # Run extraction (Chandra OCR → DoclingDocument) in parallel with
        # page rendering. Each task wrapped in its own span so the trace
        # shows them as siblings — wall time is max(chandra, render).
        async def _extract_traced() -> Any:
            with _tracer.start_as_current_span("chandra_extract"):
                return await arch.extract(pdf_bytes, filename)

        async def _render_traced() -> list[RenderedPage]:
            with _tracer.start_as_current_span("pdf2image_render"):
                return await _render_pages(pdf_bytes, dpi)

        extract_task = asyncio.create_task(_extract_traced())
        pages_task = asyncio.create_task(_render_traced())
        artifacts, rendered_pages = await asyncio.gather(extract_task, pages_task)

        with _tracer.start_as_current_span("docling_dump"):
            docling_dict = artifacts.docling_doc.export_to_dict(
                mode="json", exclude_none=True, coord_precision=2
            )

        if _is_vision_model(model):
            capped = rendered_pages[:_MAX_IMAGES_PER_REQUEST]
            if len(rendered_pages) > len(capped):
                _log.info(
                    "Capping %d page images to %d (provider image limit)",
                    len(rendered_pages),
                    len(capped),
                )
            llm_images = [
                BinaryContent(data=p.png_bytes, media_type="image/png") for p in capped
            ]
        else:
            llm_images = []

        agent = _build_agent(model, schema)
        user_message: list[Any] = [
            prompt_intro,
            f"\nOCR markdown (derived from DoclingDocument; full document text):\n\n{artifacts.markdown}",
            *llm_images,
        ]
        with _tracer.start_as_current_span("llm_agent_run") as llm_span:
            llm_span.set_attribute("page_count", len(rendered_pages))
            llm_span.set_attribute("images_sent", len(llm_images))
            llm_span.set_attribute("markdown_chars", len(artifacts.markdown))
            run = await agent.run(user_message)

        root_span.set_attribute("page_count", artifacts.page_count or 0)

        return ExtractionPipelineResult(
            doc_type=doc_type,
            model=model,
            page_count=artifacts.page_count,
            extracted=run.output.model_dump(),
            markdown=artifacts.markdown,
            docling_doc=docling_dict,
            chandra_chunks=artifacts.chunks_raw
            if isinstance(artifacts.chunks_raw, dict)
            else None,
            checkpoint_id=artifacts.checkpoint_id,
            duration_ms=int((time.perf_counter() - overall_start) * 1000),
            pages=rendered_pages,
        )
