"""Multimodal extraction pipeline.

Two variants, selected by GrowthBook flag `use_arq_pipeline`:

* **single_pass** (default, flag off):
    bytes
      → Chandra `convert(mode=accurate, output_format=chunks)`
      → DoclingDocument (canonical IR with bbox provenance)
      → multimodal LLM (markdown + page images via LiteLLM)
      → typed JSON

* **arq** (flag on):
    bytes
      → Chandra
      → DoclingDocument
      → preprocess (deterministic OCR repair) + anchor extraction
        (Tier-1 label proximity + Tier-2 table headers → FieldProvenance list)
      → multimodal LLM with ARQ-augmented schema; pre-validated anchors
        inlined into the prompt for verbatim confirmation
      → postprocess (4dp weights, ISO dates, company canon)
      → ExtractionEnvelope with per-field provenance

Both paths share Chandra + page render; only the LLM stage and post-LLM
plumbing differ. The flag is read once per request — flag flips take
effect on the next call without restart. Defaults to single_pass when
GrowthBook is unreachable so an observability outage can't silently
route traffic through the unproven path.

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
from opentelemetry.trace import Span
from pdf2image import convert_from_bytes
from pydantic import BaseModel
from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.config import settings
from app.observability import is_feature_on
from app.services.architecture import (
    DoclingArchitecture,
    DocType,
    default_architecture,
)
from app.services.extraction.anchors import extract_anchors
from app.services.extraction.arq import ARQ_BY_DOC_TYPE
from app.services.extraction.postprocess import postprocess_extracted
from app.services.extraction.preprocess import (
    extract_document_date,
    preprocess_text,
)
from app.services.extraction.result import (
    DocumentAnalysis,
    ExtractionEnvelope,
    ExtractionMetadata,
    FieldProvenance,
    StageOutput,
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
    """Everything the route + persistence layer need from one pipeline run.

    `envelope` is populated only when the ARQ pipeline variant ran (flag
    `use_arq_pipeline` on). Single-pass leaves it None — route falls back
    to the flat `extracted` dict for the response. Persistence stuffs the
    envelope into the run payload when present so eval can compare
    per-field provenance against ground truth offline.
    """

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
    envelope: ExtractionEnvelope | None = None
    pipeline_variant: str = "single_pass"


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


# ─── ARQ helpers ────────────────────────────────────────────────────────────


def _format_anchors_for_prompt(anchors: list[FieldProvenance]) -> str:
    """Render anchors as a verbatim "confirm don't modify" prompt block.

    Format is line-per-anchor, intentionally terse — long human-readable
    sentences burn tokens for no information gain. The model sees:

        PRE-VALIDATED ANCHORS (regex-anchored, treat as ground truth):
          do_number = "DO12345"  (page 1, regex_label)
          vehicle_number = "JWP8186"  (page 1, regex_table)

    Empty list returns an empty string so the caller can concatenate
    unconditionally.
    """
    if not anchors:
        return ""
    lines = ["PRE-VALIDATED ANCHORS (regex-anchored, treat as ground truth):"]
    for a in anchors:
        page_part = f", page {a.page}" if a.page is not None else ""
        lines.append(f'  {a.field} = "{a.value}"  ({a.source}{page_part})')
    lines.append(
        "Confirm these verbatim in `field_grounding`; do NOT modify their values."
    )
    return "\n".join(lines)


def _dedupe_anchors(anchors: list[FieldProvenance]) -> list[FieldProvenance]:
    """Collapse duplicate (field, value) anchors keeping the first occurrence.

    Tier-1 (label) and Tier-2 (table) frequently anchor the same field
    in tabular layouts (e.g. weighing bills with both labelled blocks
    and a values table). The merge layer keeps the first occurrence
    rather than scoring — both are confidence 1.0 and equivalent for
    the LLM's purposes; the prompt just needs each value listed once.
    """
    seen: set[tuple[str, str]] = set()
    out: list[FieldProvenance] = []
    for a in anchors:
        key = (a.field, str(a.value))
        if key in seen:
            continue
        seen.add(key)
        out.append(a)
    return out


async def _run_arq_llm_stage(
    *,
    doc_type: DocType,
    model: str,
    prompt_intro: str,
    preprocessed_markdown: str,
    anchors: list[FieldProvenance],
    llm_images: list[BinaryContent],
    parent_span: Span,
) -> tuple[dict[str, Any], int]:
    """Run the ARQ-augmented LLM stage. Returns (raw_extracted_dict, duration_ms).

    `raw_extracted_dict` is the LLM's `extracted` payload (pre-postprocess).
    The reasoning slots (`visual_audit`, `field_grounding`, `id_code_audit`)
    are emitted as span attributes for tracing and dropped — they're not
    part of the API contract.
    """
    arq_schema = ARQ_BY_DOC_TYPE[doc_type]
    agent = _build_agent(model, arq_schema)

    anchor_block = _format_anchors_for_prompt(anchors)
    user_message: list[Any] = [
        prompt_intro,
        anchor_block,
        f"\nOCR markdown (deterministic preprocess applied; full document text):\n\n{preprocessed_markdown}",
        *llm_images,
    ]
    # Strip empty parts (anchor_block can be empty when no anchors fired).
    user_message = [m for m in user_message if not (isinstance(m, str) and not m)]

    with _tracer.start_as_current_span("llm_agent_run_arq") as llm_span:
        llm_span.set_attribute("schema", arq_schema.__name__)
        llm_span.set_attribute("anchors_count", len(anchors))
        llm_span.set_attribute("images_sent", len(llm_images))
        llm_span.set_attribute("markdown_chars", len(preprocessed_markdown))
        llm_start = time.perf_counter()
        run = await agent.run(user_message)
        duration_ms = int((time.perf_counter() - llm_start) * 1000)

    arq_payload: BaseModel = run.output
    # `extracted` is the typed schema field on every *ARQ wrapper.
    extracted_obj = arq_payload.extracted  # type: ignore[attr-defined]
    extracted_dict: dict[str, Any] = extracted_obj.model_dump()

    # Surface ARQ reasoning slots on the parent span — short enough to be
    # cheap, valuable for trace UI inspection without parsing JSON dumps.
    parent_span.set_attribute(
        "arq.visual_audit",
        str(getattr(arq_payload, "visual_audit", ""))[:500],
    )
    parent_span.set_attribute(
        "arq.field_grounding",
        str(getattr(arq_payload, "field_grounding", ""))[:500],
    )
    parent_span.set_attribute(
        "arq.id_code_audit",
        str(getattr(arq_payload, "id_code_audit", ""))[:500],
    )

    return extracted_dict, duration_ms


def _build_envelope(
    *,
    doc_type: DocType,
    model: str,
    page_count: int | None,
    checkpoint_id: str | None,
    parsed_info: dict[str, Any],
    anchors: list[FieldProvenance],
    chandra_duration_ms: int,
    llm_duration_ms: int,
    total_duration_ms: int,
) -> ExtractionEnvelope:
    """Build the per-stage `ExtractionEnvelope` for the ARQ path.

    `chandra_processed.parsed_info` is the anchor-derived view (one
    field per unique anchor); `vlm_processed.parsed_info` is the raw
    LLM output. Top-level `parsed_info` is the post-processed merged
    answer the API surfaces.

    `provenance` lists the anchor entries verbatim plus a synthetic
    `vlm` entry for every parsed_info field that didn't have an anchor —
    so every populated field has at least one provenance row.
    """
    anchor_dict: dict[str, Any] = {}
    for a in anchors:
        anchor_dict.setdefault(a.field, a.value)

    anchored_fields = set(anchor_dict.keys())
    populated_fields = {k for k, v in parsed_info.items() if v not in (None, "", [])}

    chandra_stage = StageOutput(
        parsed_info=anchor_dict,
        fields_filled=sorted(anchored_fields),
        missing_fields=sorted(populated_fields - anchored_fields),
        duration_ms=chandra_duration_ms,
    )
    vlm_stage = StageOutput(
        parsed_info=parsed_info,
        fields_filled=sorted(populated_fields),
        missing_fields=[],
        duration_ms=llm_duration_ms,
    )

    # Synthesise vlm provenance for un-anchored populated fields.
    extra_provenance: list[FieldProvenance] = [
        FieldProvenance(
            field=field,
            value=parsed_info[field],
            source="vlm",
            confidence=None,
        )
        for field in sorted(populated_fields - anchored_fields)
    ]

    return ExtractionEnvelope(
        status="ok",
        doc_type=doc_type,
        parsed_info=parsed_info,
        provenance=anchors + extra_provenance,
        stage_outputs={
            "chandra_processed": chandra_stage,
            "vlm_processed": vlm_stage,
        },
        document_analysis=DocumentAnalysis(detected_type=doc_type),
        metadata=ExtractionMetadata(
            page_count=page_count,
            vlm_model=model,
            chandra_checkpoint_id=checkpoint_id,
            processing_time_ms=total_duration_ms,
        ),
    )


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
        chandra_timings: dict[str, float] = {}

        async def _extract_traced() -> Any:
            with _tracer.start_as_current_span("chandra_extract"):
                ce_start = time.perf_counter()
                result = await arch.extract(pdf_bytes, filename)
                chandra_timings["seconds"] = time.perf_counter() - ce_start
                return result

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

        # Variant selection: ARQ when flag on (default off → safer
        # single-pass on observability outage). Read-once per request so
        # mid-pipeline flag flips don't fork behaviour within a call.
        use_arq = is_feature_on("use_arq_pipeline", default=False)
        variant = "arq" if use_arq else "single_pass"
        root_span.set_attribute("pipeline_variant", variant)
        root_span.set_attribute("page_count", artifacts.page_count or 0)

        if use_arq:
            extracted_dict, envelope = await _run_arq_path(
                doc_type=doc_type,
                model=model,
                prompt_intro=prompt_intro,
                artifacts=artifacts,
                llm_images=llm_images,
                chandra_seconds=chandra_timings.get("seconds", 0.0),
                overall_start=overall_start,
                root_span=root_span,
            )
        else:
            extracted_dict = await _run_single_pass(
                schema=schema,
                model=model,
                prompt_intro=prompt_intro,
                markdown=artifacts.markdown,
                rendered_pages_count=len(rendered_pages),
                llm_images=llm_images,
            )
            envelope = None

        return ExtractionPipelineResult(
            doc_type=doc_type,
            model=model,
            page_count=artifacts.page_count,
            extracted=extracted_dict,
            markdown=artifacts.markdown,
            docling_doc=docling_dict,
            chandra_chunks=artifacts.chunks_raw
            if isinstance(artifacts.chunks_raw, dict)
            else None,
            checkpoint_id=artifacts.checkpoint_id,
            duration_ms=int((time.perf_counter() - overall_start) * 1000),
            pages=rendered_pages,
            envelope=envelope,
            pipeline_variant=variant,
        )


async def _run_single_pass(
    *,
    schema: type[BaseModel],
    model: str,
    prompt_intro: str,
    markdown: str,
    rendered_pages_count: int,
    llm_images: list[BinaryContent],
) -> dict[str, Any]:
    """Legacy single-pass LLM stage. No anchors, no postprocess, no envelope.

    Kept as the default path until ARQ has eval-confirmed parity. Body
    matches the pre-ARQ behaviour byte-for-byte so flag-off is a true
    no-op vs the previous version of this module.
    """
    agent = _build_agent(model, schema)
    user_message: list[Any] = [
        prompt_intro,
        f"\nOCR markdown (derived from DoclingDocument; full document text):\n\n{markdown}",
        *llm_images,
    ]
    with _tracer.start_as_current_span("llm_agent_run") as llm_span:
        llm_span.set_attribute("page_count", rendered_pages_count)
        llm_span.set_attribute("images_sent", len(llm_images))
        llm_span.set_attribute("markdown_chars", len(markdown))
        run = await agent.run(user_message)
    out: dict[str, Any] = run.output.model_dump()
    return out


async def _run_arq_path(
    *,
    doc_type: DocType,
    model: str,
    prompt_intro: str,
    artifacts: Any,
    llm_images: list[BinaryContent],
    chandra_seconds: float,
    overall_start: float,
    root_span: Span,
) -> tuple[dict[str, Any], ExtractionEnvelope]:
    """ARQ pipeline: preprocess → anchors → ARQ LLM → postprocess → envelope.

    Returns the postprocessed `parsed_info` dict (what the route still
    surfaces to the FE — no breaking change) plus the full envelope (DB
    persistence so eval can read provenance). All deterministic stages
    are timed under their own spans for OTel visibility.
    """
    with _tracer.start_as_current_span("preprocess_text") as pp_span:
        preprocessed_md = preprocess_text(artifacts.markdown)
        doc_date = extract_document_date(preprocessed_md)
        pp_span.set_attribute("doc_date", doc_date.isoformat() if doc_date else "")

    with _tracer.start_as_current_span("extract_anchors") as anch_span:
        chunks_dict = (
            artifacts.chunks_raw if isinstance(artifacts.chunks_raw, dict) else {}
        )
        blocks = chunks_dict.get("blocks", [])
        raw_anchors = extract_anchors(blocks, doc_date=doc_date)
        anchors = _dedupe_anchors(raw_anchors)
        anch_span.set_attribute("blocks_scanned", len(blocks))
        anch_span.set_attribute("anchors_raw", len(raw_anchors))
        anch_span.set_attribute("anchors_deduped", len(anchors))

    extracted_raw, llm_duration_ms = await _run_arq_llm_stage(
        doc_type=doc_type,
        model=model,
        prompt_intro=prompt_intro,
        preprocessed_markdown=preprocessed_md,
        anchors=anchors,
        llm_images=llm_images,
        parent_span=root_span,
    )

    with _tracer.start_as_current_span("postprocess") as post_span:
        # company_registry empty until the gazetteer lands (T10). Field-
        # level normalisation (4dp / ISO date) still runs.
        extracted_post = postprocess_extracted(
            extracted_raw, doc_type, company_registry=()
        )
        post_span.set_attribute(
            "fields_changed",
            sum(1 for k, v in extracted_raw.items() if extracted_post.get(k) != v),
        )

    total_duration_ms = int((time.perf_counter() - overall_start) * 1000)
    envelope = _build_envelope(
        doc_type=doc_type,
        model=model,
        page_count=artifacts.page_count,
        checkpoint_id=artifacts.checkpoint_id,
        parsed_info=extracted_post,
        anchors=anchors,
        chandra_duration_ms=int(chandra_seconds * 1000),
        llm_duration_ms=llm_duration_ms,
        total_duration_ms=total_duration_ms,
    )
    return extracted_post, envelope
