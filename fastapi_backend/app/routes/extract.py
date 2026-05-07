"""Document extraction routes.

POST /extract             — Chandra OCR only (no DB write).
POST /extract/structured  — Full pipeline: Chandra + page render + LLM →
                            persists Document, DocumentPage[], ExtractionRun
                            and returns the run id + payload.
"""

from __future__ import annotations

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
    document_id: str
    extraction_run_id: int
    is_new_document: bool
    filename: str
    doc_type: Literal["delivery_order", "weighing_bill", "invoice", "petrol_bill"]
    model: str
    page_count: int | None
    duration_ms: int
    extracted: dict[str, Any]
    docling_doc: dict[str, Any]
    checkpoint_id: str | None = None


def _blob_store() -> BlobStore:
    return get_blob_store()


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
            description="LiteLLM virtual model name (vision-primary, vision-fallback-1, ...)"
        ),
    ] = "vision-primary",
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

    extraction_payload = {
        "extracted": result.extracted,
        "markdown": result.markdown,
        "docling_doc": result.docling_doc,
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
        docling_doc=result.docling_doc,
        checkpoint_id=result.checkpoint_id,
    )
