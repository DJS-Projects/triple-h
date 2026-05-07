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
from app.users import get_system_user

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
    """API-facing slice of an extraction run.

    The raw `extraction_run.payload` blob (docling_doc + markdown) stays
    in the database for replay; the API only exposes `extracted_view`
    (KVPs after overlay). Visual layer is served via separate page-image
    + OCR-overlay routes.
    """

    extraction_run_id: int
    doc_type: str
    schema_version: str
    llm_model: str
    duration_ms: int
    checkpoint_id: str | None
    is_current: bool
    created_at: str
    extracted_view: dict[str, Any]
    field_pages: dict[str, int]
    reviews: list[FieldReviewSummary]


class PageDims(BaseModel):
    page_no: int
    width_px: int
    height_px: int


class BlockOverlay(BaseModel):
    """One Chandra block, projected to render-image pixel coords.

    `quad` is a 4-point polygon in the same coord system as the page
    PNG returned by `/pages/{n}.png` — the FE can position absolutely
    over the image without any further scaling.
    """

    block_id: str
    block_type: str
    text: str
    quad: list[list[float]]
    bbox: list[float]


class PageBlocksResponse(BaseModel):
    page_no: int
    width_px: int
    height_px: int
    source_width: float | None
    source_height: float | None
    blocks: list[BlockOverlay]
    field_anchors: dict[str, str]


class DocumentDetail(BaseModel):
    document: DocumentSummary
    page_count: int | None
    pages: list[PageDims]
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
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> Page[DocumentSummary]:
    """Single-tenant tool — return every document, latest first.

    Auth-free; no per-user scoping.
    """
    rows = await session.scalars(select(Document).order_by(Document.created_at.desc()))
    return paginate([DocumentSummary.from_orm(r) for r in rows])


async def _build_run_payload(session: AsyncSession, run: Any) -> ExtractionRunPayload:
    from app.services.field_anchors import compute_field_pages

    reviews = await persistence.latest_reviews_by_path(session, run.extraction_run_id)
    edits = {path: r.edited_value for path, r in reviews.items()}
    extracted_base = run.payload.get("extracted", {}) if run.payload else {}
    extracted_view = (
        apply_overlay(extracted_base, edits) if edits else dict(extracted_base)
    )
    chunks = run.payload.get("chandra_chunks") if run.payload else None
    # Anchored scalars get a 1-indexed page; unanchored scalars are
    # treated as document-level on the FE.
    field_pages = compute_field_pages(extracted_view, chunks) if chunks else {}
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
        extracted_view=extracted_view,
        field_pages=field_pages,
        reviews=review_list,
    )


@router.get("/{document_id}", response_model=DocumentDetail)
async def get_document_detail(
    document_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> DocumentDetail:
    doc = await persistence.get_document(session, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")

    run = await persistence.get_current_extraction_run(session, document_id)
    current = await _build_run_payload(session, run) if run is not None else None
    pages = await persistence.list_pages(session, document_id)
    return DocumentDetail(
        document=DocumentSummary.from_orm(doc),
        page_count=doc.page_count,
        pages=[
            PageDims(page_no=p.page_no, width_px=p.width_px, height_px=p.height_px)
            for p in pages
        ],
        current_extraction=current,
    )


@router.patch(
    "/{document_id}/extraction",
    response_model=PatchExtractionResponse,
)
async def patch_extraction(
    document_id: uuid.UUID,
    body: PatchExtractionRequest,
    user: Annotated[User, Depends(get_system_user)],
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
    if doc is None:
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
    session: Annotated[AsyncSession, Depends(get_async_session)],
    blob_store: Annotated[BlobStore, Depends(_blob_store)],
) -> Response:
    doc = await persistence.get_document(session, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")

    page = await persistence.get_page(session, document_id, page_no)
    if page is None:
        raise HTTPException(status_code=404, detail="page not found")

    try:
        data = await blob_store.get(page.blob_key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="page blob missing") from exc

    return Response(content=data, media_type="image/png")


@router.get("/{document_id}/pages/{page_no}/blocks", response_model=PageBlocksResponse)
async def get_document_page_blocks(
    document_id: uuid.UUID,
    page_no: int,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> PageBlocksResponse:
    """Return Chandra blocks for a page, scaled to the rendered PNG coord space.

    Frontend uses this to paint a transparent overlay layer over the
    page image — one absolutely-positioned element per block. Includes
    `field_anchors` so the UI can light up the matching block when a
    KVP row is hovered.
    """
    from app.services.box_overlay import (
        chandra_page_dims,
        text_boxes_from_chandra,
    )
    from app.services.field_anchors import compute_field_anchors

    doc = await persistence.get_document(session, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")

    page = await persistence.get_page(session, document_id, page_no)
    if page is None:
        raise HTTPException(status_code=404, detail="page not found")

    run = await persistence.get_current_extraction_run(session, document_id)
    if run is None or not run.payload:
        raise HTTPException(status_code=404, detail="no extraction run")

    chunks = run.payload.get("chandra_chunks") or {}
    if not chunks:
        raise HTTPException(status_code=404, detail="no chandra_chunks in run payload")

    src_size = chandra_page_dims(chunks, page_no)
    img_w, img_h = page.width_px, page.height_px
    sx = (img_w / src_size[0]) if (src_size and src_size[0] > 0) else 1.0
    sy = (img_h / src_size[1]) if (src_size and src_size[1] > 0) else 1.0

    boxes = text_boxes_from_chandra(chunks, page_no)
    blocks = chunks.get("blocks") or []
    target = page_no - 1
    blocks_on_page = [
        b for b in blocks if int(b.get("page", -1)) == target and b.get("id")
    ]

    overlays: list[BlockOverlay] = []
    for tb, raw in zip(boxes, blocks_on_page, strict=False):
        scaled_quad = [[x * sx, y * sy] for (x, y) in tb.quad]
        xs = [p[0] for p in scaled_quad]
        ys = [p[1] for p in scaled_quad]
        bbox = [min(xs), min(ys), max(xs), max(ys)]
        overlays.append(
            BlockOverlay(
                block_id=str(raw.get("id")),
                block_type=tb.block_type,
                text=tb.text,
                quad=scaled_quad,
                bbox=bbox,
            )
        )

    extracted = run.payload.get("extracted") or {}
    anchors = compute_field_anchors(extracted, chunks, page_no=page_no)

    return PageBlocksResponse(
        page_no=page_no,
        width_px=img_w,
        height_px=img_h,
        source_width=src_size[0] if src_size else None,
        source_height=src_size[1] if src_size else None,
        blocks=overlays,
        field_anchors=anchors,
    )


@router.get("/{document_id}/pages/{page_no}/annotated.png")
async def get_document_page_annotated(
    document_id: uuid.UUID,
    page_no: int,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    blob_store: Annotated[BlobStore, Depends(_blob_store)],
) -> Response:
    """Return the page with OCR detection boxes overlaid + text panel.

    Reads `docling_doc` off the current extraction run and composites
    boxes onto the cached page PNG. Cheap to recompute on demand — no
    pre-rendering, no extra blob storage.
    """
    # Local import keeps PIL out of the cold path for non-overlay routes.
    from app.services.box_overlay import (
        chandra_page_dims,
        render_overlay,
        text_boxes_from_chandra,
    )

    doc = await persistence.get_document(session, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")

    page = await persistence.get_page(session, document_id, page_no)
    if page is None:
        raise HTTPException(status_code=404, detail="page not found")

    run = await persistence.get_current_extraction_run(session, document_id)
    if run is None or not run.payload:
        raise HTTPException(status_code=404, detail="no extraction run")

    chunks = run.payload.get("chandra_chunks") or {}
    if not chunks:
        raise HTTPException(status_code=404, detail="no chandra_chunks in run payload")

    try:
        png_bytes = await blob_store.get(page.blob_key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="page blob missing") from exc

    boxes = text_boxes_from_chandra(chunks, page_no)
    page_size = chandra_page_dims(chunks, page_no)
    composited = render_overlay(png_bytes, boxes, source_page_size=page_size)

    return Response(
        content=composited,
        media_type="image/png",
        # Cache per-run: same docling_doc + same page = same overlay.
        headers={"Cache-Control": "private, max-age=300"},
    )
