"""DB write layer for the extraction pipeline.

Pattern C: pipeline → persistence → return ids. This module is the *only*
place that touches `document`, `document_page`, `extraction_run`,
`field_review` for writes. Routes call into here; nothing else does.

Each function takes an `AsyncSession` so the caller controls transaction
scope. We do NOT commit inside helpers — the route commits once at the end
of a successful pipeline run.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Document,
    DocumentPage,
    ExtractionRun,
    FieldReview,
    RefinementRun,
)
from app.services.blob_store import (
    BlobStore,
    document_key,
    page_key,
    sha256_hex,
)

# Bump when the `extraction_run.payload` shape changes incompatibly.
PAYLOAD_SCHEMA_VERSION = "extraction.v1"


async def ingest_document(
    session: AsyncSession,
    *,
    blob_store: BlobStore,
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    uploaded_by: uuid.UUID,
) -> tuple[Document, bool]:
    """Upsert a document by sha256 hash.

    Returns ``(document, is_new)`` where ``is_new`` is False when an
    earlier upload of the same bytes already exists. Re-uploads do not
    duplicate blobs or rows.
    """
    sha = sha256_hex(file_bytes)
    existing = await session.scalar(select(Document).where(Document.sha256 == sha))
    if existing is not None:
        return existing, False

    blob = document_key(sha)
    await blob_store.put(blob, file_bytes, content_type=mime_type)

    doc = Document(
        uploaded_by=uploaded_by,
        filename=filename,
        mime_type=mime_type,
        size_bytes=len(file_bytes),
        blob_key=blob,
        sha256=sha,
        status="uploaded",
    )
    session.add(doc)
    await session.flush()  # populate doc.document_id
    return doc, True


async def record_pages(
    session: AsyncSession,
    *,
    blob_store: BlobStore,
    document: Document,
    pages: list[tuple[int, int, int, bytes]],
) -> list[DocumentPage]:
    """Persist per-page PNGs to the blob store and write `document_page` rows.

    `pages` is a list of ``(page_no, width_px, height_px, png_bytes)``.
    Idempotent: if a page row already exists for this document, the blob is
    re-written but the DB row is reused.
    """
    if not pages:
        return []

    existing_rows = await session.scalars(
        select(DocumentPage).where(DocumentPage.document_id == document.document_id)
    )
    existing_by_page = {row.page_no: row for row in existing_rows}

    out: list[DocumentPage] = []
    for page_no, width, height, png_bytes in pages:
        key = page_key(str(document.document_id), page_no)
        await blob_store.put(key, png_bytes, content_type="image/png")
        row = existing_by_page.get(page_no)
        if row is None:
            row = DocumentPage(
                document_id=document.document_id,
                page_no=page_no,
                width_px=width,
                height_px=height,
                blob_key=key,
            )
            session.add(row)
        else:
            row.width_px = width
            row.height_px = height
            row.blob_key = key
        out.append(row)

    document.page_count = len(pages)
    await session.flush()
    return out


async def record_extraction_run(
    session: AsyncSession,
    *,
    document: Document,
    doc_type: str,
    llm_model: str,
    checkpoint_id: str | None,
    duration_ms: int,
    payload: dict[str, Any],
    schema_version: str = PAYLOAD_SCHEMA_VERSION,
) -> ExtractionRun:
    """Append a new run, demote any prior `is_current` row for this doc.

    The unique partial index `uq_extraction_run_one_current_per_doc` on
    `(document_id) WHERE is_current` enforces that only one current run can
    exist per document. We flip the old one *before* inserting the new one
    inside the same transaction.
    """
    await session.execute(
        update(ExtractionRun)
        .where(
            ExtractionRun.document_id == document.document_id,
            ExtractionRun.is_current.is_(True),
        )
        .values(is_current=False)
    )

    run = ExtractionRun(
        document_id=document.document_id,
        doc_type=doc_type,
        schema_version=schema_version,
        llm_model=llm_model,
        checkpoint_id=checkpoint_id,
        duration_ms=duration_ms,
        payload=payload,
        is_current=True,
    )
    session.add(run)

    document.doc_type = doc_type
    document.status = "extracted"
    await session.flush()
    return run


async def record_field_review(
    session: AsyncSession,
    *,
    extraction_run_id: int,
    reviewer_id: uuid.UUID,
    field_path: str,
    original_value: Any | None,
    edited_value: Any,
    remark: str | None = None,
) -> FieldReview:
    review = FieldReview(
        extraction_run_id=extraction_run_id,
        reviewer_id=reviewer_id,
        field_path=field_path,
        original_value=original_value,
        edited_value=edited_value,
        remark=remark,
    )
    session.add(review)
    await session.flush()
    return review


async def latest_reviews_by_path(
    session: AsyncSession, extraction_run_id: int
) -> dict[str, FieldReview]:
    """Return the latest `FieldReview` per `field_path` for an extraction run.

    Used to materialise the user-visible payload by overlaying edits on top
    of the immutable LLM-produced extraction. We sort ascending and let the
    last write win — equivalent to `DISTINCT ON (field_path) ... ORDER BY
    created_at DESC` but kept in Python to stay portable.
    """
    rows = await session.scalars(
        select(FieldReview)
        .where(FieldReview.extraction_run_id == extraction_run_id)
        .order_by(FieldReview.created_at.asc(), FieldReview.field_review_id.asc())
    )
    out: dict[str, FieldReview] = {}
    for row in rows:
        out[row.field_path] = row
    return out


async def get_document(
    session: AsyncSession, document_id: uuid.UUID
) -> Document | None:
    return await session.get(Document, document_id)


async def get_current_extraction_run(
    session: AsyncSession, document_id: uuid.UUID
) -> ExtractionRun | None:
    return await session.scalar(
        select(ExtractionRun).where(
            ExtractionRun.document_id == document_id,
            ExtractionRun.is_current.is_(True),
        )
    )


async def get_page(
    session: AsyncSession, document_id: uuid.UUID, page_no: int
) -> DocumentPage | None:
    return await session.scalar(
        select(DocumentPage).where(
            DocumentPage.document_id == document_id,
            DocumentPage.page_no == page_no,
        )
    )


async def list_pages(
    session: AsyncSession, document_id: uuid.UUID
) -> list[DocumentPage]:
    """Page rows for a document, ordered by page_no."""
    rows = await session.scalars(
        select(DocumentPage)
        .where(DocumentPage.document_id == document_id)
        .order_by(DocumentPage.page_no.asc())
    )
    return list(rows)


async def get_extraction_run(
    session: AsyncSession, extraction_run_id: int
) -> ExtractionRun | None:
    return await session.get(ExtractionRun, extraction_run_id)


async def record_refinement_run(
    session: AsyncSession,
    *,
    extraction_run_id: int,
    vlm_model: str,
    prompt_version: str,
    scaffold_in: dict[str, Any],
    scaffold_out: dict[str, Any],
    patches: list[dict[str, Any]],
    arq_trace: dict[str, Any],
    token_usage: dict[str, Any] | None,
    duration_ms: int,
) -> RefinementRun:
    """Append a new refinement run, demote any prior `is_current` row.

    The unique partial index `uq_refinement_run_one_current_per_extraction`
    guarantees one current refinement per extraction. Same demote-then-
    insert pattern as `record_extraction_run` so the constraint never
    sees two `is_current` rows simultaneously.
    """
    await session.execute(
        update(RefinementRun)
        .where(
            RefinementRun.extraction_run_id == extraction_run_id,
            RefinementRun.is_current.is_(True),
        )
        .values(is_current=False)
    )

    run = RefinementRun(
        extraction_run_id=extraction_run_id,
        vlm_model=vlm_model,
        prompt_version=prompt_version,
        scaffold_in=scaffold_in,
        scaffold_out=scaffold_out,
        patches=patches,
        arq_trace=arq_trace,
        token_usage=token_usage,
        duration_ms=duration_ms,
        is_current=True,
    )
    session.add(run)
    await session.flush()
    return run


async def get_current_refinement_run(
    session: AsyncSession, extraction_run_id: int
) -> RefinementRun | None:
    return await session.scalar(
        select(RefinementRun).where(
            RefinementRun.extraction_run_id == extraction_run_id,
            RefinementRun.is_current.is_(True),
        )
    )
