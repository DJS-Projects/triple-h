"""Document extraction routes.

POST /extract             — Chandra OCR only (no DB write).
POST /extract/structured  — Full pipeline: Chandra + page render + LLM →
                            persists Document, DocumentPage[], ExtractionRun
                            and returns the run id + payload.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.models import User
from app.services import persistence
from app.services.blob_store import BlobStore, get_blob_store
from app.services.architecture import DocType
from app.services.chandra_ocr import convert_bytes_with_chunks_async
from app.services.extraction import extract_structured
from app.users import get_system_user

router = APIRouter(tags=["extract"])


class ExtractResponse(BaseModel):
    filename: str
    page_count: int | None
    markdown: str
    html: str | None = None
    chunks: dict[str, Any] | None = None
    checkpoint_id: str | None = None


class StructuredExtractResponse(BaseModel):
    """API-facing payload for `/extract/structured`.

    Intentionally omits `docling_doc` and `markdown` (kept in DB for
    replay/eval, not surfaced to the UI). `extracted` is the
    constrained-decoded JSON for the KVP table. The visual layer is
    served separately via the page-image + OCR-overlay routes.
    """

    document_id: str
    extraction_run_id: int
    is_new_document: bool
    filename: str
    doc_type: Literal["delivery_order", "weighing_bill", "invoice", "petrol_bill"]
    model: str
    page_count: int | None
    duration_ms: int
    extracted: dict[str, Any]
    checkpoint_id: str | None = None


class ExtractionModelOption(BaseModel):
    """One row in the FE model dropdown."""

    id: str
    label: str
    provider: str
    supports_multi_image: bool
    is_default: bool = False
    note: str | None = None


# Source of truth for the FE model dropdown. Keep in sync with
# litellm/config.yaml — adding a model here without a matching entry
# there will fail at request time.
EXTRACTION_MODELS: list[ExtractionModelOption] = [
    ExtractionModelOption(
        id="gemma-4-31b",
        label="Gemma 4 31B (vision)",
        provider="Google AI Studio",
        supports_multi_image=True,
        is_default=True,
        note="Default. Open-weights, free tier via Google AI Studio.",
    ),
    ExtractionModelOption(
        id="groq-llama4-scout",
        label="Llama 4 Scout 17B (vision)",
        provider="Groq",
        supports_multi_image=True,
        note="Open-weights. Fast. Watch for max_completion_tokens cutoff on long schemas.",
    ),
    ExtractionModelOption(
        id="groq-llama4-maverick",
        label="Llama 4 Maverick 17B 128e (vision)",
        provider="Groq",
        supports_multi_image=True,
        note="Open-weights. Larger MoE — better recall, slower.",
    ),
    ExtractionModelOption(
        id="nim-llama-90b-vision",
        label="Llama 3.2 90B Vision",
        provider="NVIDIA NIM",
        supports_multi_image=False,
        note="Open-weights. Single-image only — single-page docs only.",
    ),
]


def _blob_store() -> BlobStore:
    return get_blob_store()


@router.get("/extract/models", response_model=list[ExtractionModelOption])
async def list_extraction_models() -> list[ExtractionModelOption]:
    """Return the model menu shown in the FE upload dropdown."""
    return EXTRACTION_MODELS


@router.post("/extract", response_model=ExtractResponse)
async def extract_document(
    file: Annotated[UploadFile, File(description="PDF or image file")],
) -> ExtractResponse:
    """Chandra-only path: returns raw chunks + markdown without persisting."""
    if file.filename is None:
        raise HTTPException(status_code=400, detail="missing filename")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="empty file")

    try:
        result = await convert_bytes_with_chunks_async(file_bytes, file.filename)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"chandra: {exc}") from exc

    if not result.success:
        raise HTTPException(
            status_code=502, detail=f"chandra: {result.error or 'unknown error'}"
        )

    return ExtractResponse(
        filename=file.filename,
        page_count=result.page_count,
        markdown=result.markdown or "",
        html=result.html,
        chunks=result.chunks if isinstance(result.chunks, dict) else None,
        checkpoint_id=result.checkpoint_id,
    )


@router.post("/extract/structured", response_model=StructuredExtractResponse)
async def extract_document_structured(
    file: Annotated[UploadFile, File(description="PDF or image file")],
    # Accept `str` (not `DocType | None`) so Swagger's empty-string default
    # doesn't fail Literal validation. We normalise + validate below.
    doc_type: Annotated[
        str | None,
        Form(
            description=(
                "Optional manual override: delivery_order | weighing_bill | "
                "invoice | petrol_bill. Leave empty to auto-classify via "
                "Gemma vision."
            )
        ),
    ] = None,
    model: Annotated[
        str,
        Form(
            description=(
                "LiteLLM model id (gemma-4-31b, gemini-2.5-flash, ...). "
                "See GET /extract/models for the full list."
            )
        ),
    ] = "gemma-4-31b",
    dpi: Annotated[int, Form(description="PDF render DPI")] = 150,
    user: User = Depends(get_system_user),
    session: AsyncSession = Depends(get_async_session),
    blob_store: BlobStore = Depends(_blob_store),
) -> StructuredExtractResponse:
    """Persist the upload, run the pipeline, persist the run, return ids."""
    if file.filename is None:
        raise HTTPException(status_code=400, detail="missing filename")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="empty file")

    # Normalise empty string → None (Swagger default). Validate the label
    # against the allowed set; unknown labels get a 400 instead of a 500
    # from the schema lookup downstream.
    normalised_doc_type: DocType | None
    if doc_type is None or doc_type == "":
        normalised_doc_type = None
    elif doc_type in ("delivery_order", "weighing_bill", "invoice", "petrol_bill"):
        normalised_doc_type = doc_type  # type: ignore[assignment]
    else:
        raise HTTPException(
            status_code=400,
            detail=(
                f"unknown doc_type {doc_type!r}; allowed: delivery_order, "
                "weighing_bill, invoice, petrol_bill (or omit to auto-classify)"
            ),
        )

    document, is_new = await persistence.ingest_document(
        session,
        blob_store=blob_store,
        file_bytes=file_bytes,
        filename=file.filename,
        mime_type=file.content_type or "application/pdf",
        uploaded_by=user.id,
    )

    try:
        result = await extract_structured(
            file_bytes,
            file.filename,
            doc_type=normalised_doc_type,
            model=model,
            dpi=dpi,
        )
    except RuntimeError as exc:
        # Pipeline raises RuntimeError for Chandra failures; LLM failures
        # bubble up as the SDK's own exception types.
        msg = str(exc)
        if msg.startswith("Chandra"):
            raise HTTPException(status_code=502, detail=f"chandra: {exc}") from exc
        raise HTTPException(status_code=502, detail=f"llm: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"llm: {exc}") from exc

    await persistence.record_pages(
        session,
        blob_store=blob_store,
        document=document,
        pages=[(p.page_no, p.width_px, p.height_px, p.png_bytes) for p in result.pages],
    )

    # DB payload keeps the full provenance: docling_doc for replay/eval,
    # markdown for LLM re-runs, chandra_chunks for the block-level
    # overlay (per-block bbox + html, native from OCR — no lossy Docling
    # round-trip). None of these cross the API boundary — only
    # `extracted` is shipped to the UI.
    extraction_payload = {
        "extracted": result.extracted,
        "markdown": result.markdown,
        "docling_doc": result.docling_doc,
        "chandra_chunks": result.chandra_chunks,
    }
    run = await persistence.record_extraction_run(
        session,
        document=document,
        doc_type=result.doc_type,
        llm_model=result.model,
        checkpoint_id=result.checkpoint_id,
        duration_ms=result.duration_ms,
        payload=extraction_payload,
    )
    await session.commit()

    return StructuredExtractResponse(
        document_id=str(document.document_id),
        extraction_run_id=run.extraction_run_id,
        is_new_document=is_new,
        filename=document.filename,
        doc_type=result.doc_type,
        model=result.model,
        page_count=result.page_count,
        duration_ms=result.duration_ms,
        extracted=result.extracted,
        checkpoint_id=result.checkpoint_id,
    )


class ReextractRequest(BaseModel):
    """Body for re-running the LLM pipeline against an already-uploaded doc."""

    doc_type: DocType | None = None
    model: str = "gemma-4-31b"
    dpi: int = 150


@router.post(
    "/documents/{document_id}/reextract",
    response_model=StructuredExtractResponse,
)
async def reextract_document(
    document_id: uuid.UUID,
    body: ReextractRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    blob_store: Annotated[BlobStore, Depends(_blob_store)],
) -> StructuredExtractResponse:
    """Re-run Chandra + LLM extraction for an existing document.

    Pulls the original PDF bytes back out of blob storage, drives the
    full pipeline, persists a new ExtractionRun (the previous one is
    automatically demoted by `record_extraction_run`).

    Idempotent: appending a new run never overwrites edits — field
    reviews remain attached to whichever run they were made on.
    """
    document = await persistence.get_document(session, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="document not found")

    try:
        file_bytes = await blob_store.get(document.blob_key)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=410, detail="original document blob missing"
        ) from exc

    try:
        result = await extract_structured(
            file_bytes,
            document.filename,
            doc_type=body.doc_type,
            model=body.model,
            dpi=body.dpi,
        )
    except RuntimeError as exc:
        msg = str(exc)
        if msg.startswith("Chandra"):
            raise HTTPException(status_code=502, detail=f"chandra: {exc}") from exc
        raise HTTPException(status_code=502, detail=f"llm: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"llm: {exc}") from exc

    # Re-render pages — Chandra page count or DPI may have changed,
    # and re-running gives us a fresh chandra_chunks coord space.
    await persistence.record_pages(
        session,
        blob_store=blob_store,
        document=document,
        pages=[(p.page_no, p.width_px, p.height_px, p.png_bytes) for p in result.pages],
    )

    extraction_payload = {
        "extracted": result.extracted,
        "markdown": result.markdown,
        "docling_doc": result.docling_doc,
        "chandra_chunks": result.chandra_chunks,
    }
    run = await persistence.record_extraction_run(
        session,
        document=document,
        doc_type=result.doc_type,
        llm_model=result.model,
        checkpoint_id=result.checkpoint_id,
        duration_ms=result.duration_ms,
        payload=extraction_payload,
    )
    await session.commit()

    return StructuredExtractResponse(
        document_id=str(document.document_id),
        extraction_run_id=run.extraction_run_id,
        is_new_document=False,
        filename=document.filename,
        doc_type=result.doc_type,
        model=result.model,
        page_count=result.page_count,
        duration_ms=result.duration_ms,
        extracted=result.extracted,
        checkpoint_id=result.checkpoint_id,
    )
