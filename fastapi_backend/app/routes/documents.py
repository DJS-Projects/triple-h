"""Document read routes.

GET /documents                       — list (paginated, latest-first)
GET /documents/{id}                  — doc + current extraction run
GET /documents/{id}/pages/{n}.png    — pre-rendered page PNG
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi_pagination import Page, paginate
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.database import get_async_session
from app.models import Document, User
from app.services import persistence
from app.services.blob_store import BlobStore, get_blob_store
from app.services.extraction_overlay import apply_overlay, get_at_path
from app.users import current_active_user

router = APIRouter(prefix="/documents", tags=["documents"])


class DocumentSummary(BaseModel):
    document_id: str
    filename: str
    mime_type: str
    size_bytes: int
    page_count: int | None
    doc_type: str | None
    status: str
    created_at: str

    @classmethod
    def from_orm(cls, doc: Document) -> "DocumentSummary":
        return cls(
            document_id=str(doc.document_id),
            filename=doc.filename,
            mime_type=doc.mime_type,
            size_bytes=doc.size_bytes,
            page_count=doc.page_count,
            doc_type=doc.doc_type,
            status=doc.status,
            created_at=doc.created_at.isoformat(),
        )


class FieldReviewSummary(BaseModel):
    field_path: str
    edited_value: Any
    original_value: Any | None
    remark: str | None
    created_at: str


class ExtractionRunPayload(BaseModel):
    extraction_run_id: int
    doc_type: str
    schema_version: str
    llm_model: str
    duration_ms: int
    checkpoint_id: str | None
    is_current: bool
    created_at: str
    payload: dict[str, Any]
    # `extracted_view` is `payload["extracted"]` with the latest field
    # reviews overlaid; `payload` itself stays immutable.
    extracted_view: dict[str, Any]
    reviews: list[FieldReviewSummary]


class DocumentDetail(BaseModel):
    document: DocumentSummary
    page_count: int | None
    current_extraction: ExtractionRunPayload | None


class FieldEdit(BaseModel):
    field_path: str
    edited_value: Any
    remark: str | None = None


class PatchExtractionRequest(BaseModel):
    edits: list[FieldEdit]


class PatchExtractionResponse(BaseModel):
    extraction_run_id: int
    applied: int
    extracted_view: dict[str, Any]
    reviews: list[FieldReviewSummary]


def _blob_store() -> BlobStore:
    return get_blob_store()


@router.get("", response_model=Page[DocumentSummary])
async def list_documents(
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> Page[DocumentSummary]:
    rows = await session.scalars(
        select(Document)
        .where(Document.uploaded_by == user.id)
        .order_by(Document.created_at.desc())
    )
    return paginate([DocumentSummary.from_orm(r) for r in rows])


async def _build_run_payload(session: AsyncSession, run: Any) -> ExtractionRunPayload:
    reviews = await persistence.latest_reviews_by_path(session, run.extraction_run_id)
    edits = {path: r.edited_value for path, r in reviews.items()}
    extracted_base = run.payload.get("extracted", {}) if run.payload else {}
    extracted_view = (
        apply_overlay(extracted_base, edits) if edits else dict(extracted_base)
    )
    review_list = [
        FieldReviewSummary(
            field_path=r.field_path,
            edited_value=r.edited_value,
            original_value=r.original_value,
            remark=r.remark,
            created_at=r.created_at.isoformat(),
        )
        for r in reviews.values()
    ]
    return ExtractionRunPayload(
        extraction_run_id=run.extraction_run_id,
        doc_type=run.doc_type,
        schema_version=run.schema_version,
        llm_model=run.llm_model,
        duration_ms=run.duration_ms,
        checkpoint_id=run.checkpoint_id,
        is_current=run.is_current,
        created_at=run.created_at.isoformat(),
        payload=run.payload,
        extracted_view=extracted_view,
        reviews=review_list,
    )


@router.get("/{document_id}", response_model=DocumentDetail)
async def get_document_detail(
    document_id: uuid.UUID,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> DocumentDetail:
    doc = await persistence.get_document(session, document_id)
    if doc is None or doc.uploaded_by != user.id:
        raise HTTPException(status_code=404, detail="document not found")

    run = await persistence.get_current_extraction_run(session, document_id)
    current = await _build_run_payload(session, run) if run is not None else None
    return DocumentDetail(
        document=DocumentSummary.from_orm(doc),
        page_count=doc.page_count,
        current_extraction=current,
    )


@router.patch(
    "/{document_id}/extraction",
    response_model=PatchExtractionResponse,
)
async def patch_extraction(
    document_id: uuid.UUID,
    body: PatchExtractionRequest,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> PatchExtractionResponse:
    """Append `field_review` rows; do NOT mutate `extraction_run.payload`.

    Edits are derived at read time by overlaying the latest review per
    `field_path`. Re-runs of the pipeline therefore never silently overwrite
    a user's corrections — the new run produces a fresh immutable payload,
    but the human edits remain attached to whichever run they were made on.
    """
    if not body.edits:
        raise HTTPException(status_code=400, detail="no edits supplied")

    doc = await persistence.get_document(session, document_id)
    if doc is None or doc.uploaded_by != user.id:
        raise HTTPException(status_code=404, detail="document not found")

    run = await persistence.get_current_extraction_run(session, document_id)
    if run is None:
        raise HTTPException(status_code=409, detail="no current extraction to edit")

    extracted_base = run.payload.get("extracted", {}) if run.payload else {}
    for edit in body.edits:
        original = get_at_path(extracted_base, edit.field_path)
        await persistence.record_field_review(
            session,
            extraction_run_id=run.extraction_run_id,
            reviewer_id=user.id,
            field_path=edit.field_path,
            original_value=original,
            edited_value=edit.edited_value,
            remark=edit.remark,
        )
    doc.status = "reviewed"
    await session.commit()

    payload = await _build_run_payload(session, run)
    return PatchExtractionResponse(
        extraction_run_id=run.extraction_run_id,
        applied=len(body.edits),
        extracted_view=payload.extracted_view,
        reviews=payload.reviews,
    )


@router.get("/{document_id}/pages/{page_no}.png")
async def get_document_page_png(
    document_id: uuid.UUID,
    page_no: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    blob_store: Annotated[BlobStore, Depends(_blob_store)],
) -> Response:
    doc = await persistence.get_document(session, document_id)
    if doc is None or doc.uploaded_by != user.id:
        raise HTTPException(status_code=404, detail="document not found")

    page = await persistence.get_page(session, document_id, page_no)
    if page is None:
        raise HTTPException(status_code=404, detail="page not found")

    try:
        data = await blob_store.get(page.blob_key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="page blob missing") from exc

    return Response(content=data, media_type="image/png")
