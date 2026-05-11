"""Async extraction job routes.

* POST /extract/jobs       — submit an upload; returns 202 + job_id.
                             Idempotency-Key header dedups against
                             active jobs. Worker picks up + processes.
* GET  /jobs/{job_id}      — poll for job status (FE 1-2s loop).
* GET  /jobs/{job_id}/stream — SSE feed for the same data, real-time.

The legacy synchronous `/extract/structured` route is unchanged; tests
+ CLI clients keep working. This file adds the async/queue path
without breaking the sync one.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker, get_async_session
from app.models import User
from app.services import job_queue, persistence
from app.services.architecture import DocType
from app.services.blob_store import BlobStore, get_blob_store
from app.users import get_system_user

router = APIRouter(tags=["jobs"])


def _blob_store() -> BlobStore:
    return get_blob_store()


# ─── Response shapes ────────────────────────────────────────────────────────


class SubmitJobResponse(BaseModel):
    """202 Accepted response when a job is queued (or reused)."""

    job_id: str
    document_id: str
    is_new_document: bool
    deduped: bool  # True = existing active job returned, False = newly created
    status: str  # current status snapshot
    poll_url: str
    stream_url: str


class JobStatusResponse(BaseModel):
    """Job status snapshot for polling."""

    job_id: str
    document_id: str
    status: str  # pending | running | succeeded | failed
    stage: str | None
    error: str | None
    run_id: int | None
    attempts: int
    created_at: str
    started_at: str | None
    finished_at: str | None


class JobListItem(BaseModel):
    """Listing-flavoured projection of an extraction_job row.

    Includes the human-meaningful display fields (filename, model) so the
    FE can render the queue without joining to Document.
    """

    job_id: str
    document_id: str
    filename: str | None
    model: str
    status: str
    stage: str | None
    error: str | None
    run_id: int | None
    attempts: int
    deduped: bool  # always False from list — we don't know origin intent
    created_at: str
    started_at: str | None
    finished_at: str | None


# ─── POST /extract/jobs ─────────────────────────────────────────────────────


@router.post("/extract/jobs", response_model=SubmitJobResponse, status_code=202)
async def submit_extraction_job(
    file: Annotated[UploadFile, File(description="PDF or image file")],
    doc_type: Annotated[
        str | None,
        Form(
            description=(
                "Optional manual override: delivery_order | weighing_bill | "
                "invoice | petrol_bill. Leave empty to auto-classify."
            )
        ),
    ] = None,
    model: Annotated[
        str,
        Form(description="LiteLLM model id"),
    ] = "ollama-gemma4-31b",
    dpi: Annotated[int, Form(description="PDF render DPI")] = 150,
    idempotency_key: Annotated[
        str | None,
        Header(
            alias="Idempotency-Key",
            description=(
                "Client-supplied UUID (or any stable string) representing "
                "this upload intent. Same key + active job = returns the "
                "existing job, no duplicate work. Server generates one if "
                "omitted (then the only dedup is via content_hash)."
            ),
        ),
    ] = None,
    user: User = Depends(get_system_user),
    session: AsyncSession = Depends(get_async_session),
    blob_store: BlobStore = Depends(_blob_store),
) -> SubmitJobResponse:
    """Queue an extraction job. Returns 202 + job_id immediately.

    The synchronous path (`/extract/structured`) blocks for ~30-200s
    waiting on the pipeline. This path returns in ~200ms — the worker
    pool actually runs the pipeline asynchronously. FE polls or
    subscribes to SSE for status.
    """
    if file.filename is None:
        raise HTTPException(status_code=400, detail="missing filename")
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="empty file")

    # Normalise doc_type (same logic as sync path).
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
                "weighing_bill, invoice, petrol_bill"
            ),
        )

    # Server-generate an idempotency key when the client omits one.
    # The (content_hash, model, doc_type) index still dedups identical
    # re-uploads even without a client key.
    effective_idem_key = idempotency_key or str(uuid.uuid4())

    # Ingest the document (idempotent on sha256).
    document, is_new = await persistence.ingest_document(
        session,
        blob_store=blob_store,
        file_bytes=file_bytes,
        filename=file.filename,
        mime_type=file.content_type or "application/pdf",
        uploaded_by=user.id,
    )

    request_meta: dict[str, Any] = {
        "filename": file.filename,
        "dpi": dpi,
        "mime_type": file.content_type or "application/pdf",
        "size_bytes": len(file_bytes),
    }

    # Snapshot document attributes BEFORE handing off to the queue
    # service. create_or_get_job() does an INSERT-then-catch-IntegrityError
    # dance; the catch path calls session.rollback() which expires every
    # ORM instance in the session, including this `document`. After that,
    # `document.document_id` would trigger an async lazy-load from a sync
    # context → MissingGreenlet. Capture now, use later.
    doc_uuid = document.document_id
    document_id_str = str(doc_uuid)
    content_sha = document.sha256

    result = await job_queue.create_or_get_job(
        session,
        document_id=doc_uuid,
        idempotency_key=effective_idem_key,
        content_hash=content_sha,
        model=model,
        doc_type=normalised_doc_type,
        request_meta=request_meta,
    )

    # `result.job` is freshly attached (either flushed insert or re-query
    # result), so its attrs are populated. Snapshot anyway to dodge the
    # post-commit expiry trap.
    job = result.job
    job_id_str = str(job.job_id)
    job_status = job.status

    await session.commit()

    return SubmitJobResponse(
        job_id=job_id_str,
        document_id=document_id_str,
        is_new_document=is_new,
        deduped=not result.created,
        status=job_status,
        poll_url=f"/jobs/{job_id_str}",
        stream_url=f"/jobs/{job_id_str}/stream",
    )


# ─── GET /jobs/{job_id} ─────────────────────────────────────────────────────


def _job_to_status(job: Any) -> JobStatusResponse:
    return JobStatusResponse(
        job_id=str(job.job_id),
        document_id=str(job.document_id),
        status=job.status,
        stage=job.stage,
        error=job.error,
        run_id=job.run_id,
        attempts=job.attempts,
        created_at=job.created_at.isoformat() if job.created_at else "",
        started_at=job.started_at.isoformat() if job.started_at else None,
        finished_at=job.finished_at.isoformat() if job.finished_at else None,
    )


def _job_to_list_item(job: Any) -> JobListItem:
    request_meta = job.request_meta if isinstance(job.request_meta, dict) else {}
    filename = request_meta.get("filename") if isinstance(request_meta, dict) else None
    return JobListItem(
        job_id=str(job.job_id),
        document_id=str(job.document_id),
        filename=filename if isinstance(filename, str) else None,
        model=job.model,
        status=job.status,
        stage=job.stage,
        error=job.error,
        run_id=job.run_id,
        attempts=job.attempts,
        deduped=False,
        created_at=job.created_at.isoformat() if job.created_at else "",
        started_at=job.started_at.isoformat() if job.started_at else None,
        finished_at=job.finished_at.isoformat() if job.finished_at else None,
    )


@router.get("/jobs", response_model=list[JobListItem])
async def list_jobs(
    limit: int = 50,
    statuses: str | None = None,  # comma-separated, e.g. "pending,running"
    _user: User = Depends(get_system_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[JobListItem]:
    """List recent jobs newest-first, optionally filtered by status.

    Used by the FE queue panel to hydrate across page refreshes so users
    don't lose visibility of jobs they queued in a previous session.
    """
    parsed_statuses: tuple[str, ...] | None = None
    if statuses:
        allowed = {"pending", "running", "succeeded", "failed"}
        parsed_statuses = tuple(
            s.strip() for s in statuses.split(",") if s.strip() in allowed
        )
        if not parsed_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"unknown status filter; allowed: {sorted(allowed)}",
            )
    rows = await job_queue.list_recent_jobs(
        session, limit=limit, statuses=parsed_statuses
    )
    return [_job_to_list_item(r) for r in rows]


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: uuid.UUID,
    _user: User = Depends(get_system_user),
    session: AsyncSession = Depends(get_async_session),
) -> JobStatusResponse:
    """Snapshot of a job's state. FE polls this 1-2s for status updates."""
    job = await job_queue.get_job(session, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return _job_to_status(job)


# ─── GET /jobs/{job_id}/stream (SSE) ────────────────────────────────────────


def _sse_event(data: dict[str, Any], event: str | None = None) -> str:
    """Render one SSE frame. `data:` line is required; `event:` is optional."""
    lines = []
    if event:
        lines.append(f"event: {event}")
    lines.append(f"data: {json.dumps(data)}")
    return "\n".join(lines) + "\n\n"


@router.get("/jobs/{job_id}/stream")
async def stream_job_status(
    job_id: uuid.UUID,
    _user: User = Depends(get_system_user),
) -> StreamingResponse:
    """Server-sent-events feed for a job's lifecycle.

    Implemented as a simple DB-poll loop (~500ms cadence) that yields
    a frame whenever the (status, stage) tuple changes. The client
    keeps the connection open until status enters a terminal state
    (succeeded / failed); we send a final frame and close.

    Why not LISTEN/NOTIFY? Polling is dead simple, reload-safe, and
    500ms lag is invisible to humans. We can swap to NOTIFY if multiple
    workers contend on a single job (they shouldn't).
    """
    poll_interval_s = 0.5
    timeout_s = 600.0  # hard cap; keep-alive over this is silly

    async def _gen() -> AsyncIterator[str]:
        # Open with a SSE retry hint so the browser auto-reconnects.
        yield "retry: 2000\n\n"
        last_signature: tuple[str, str | None] | None = None
        terminal = {"succeeded", "failed"}
        elapsed = 0.0
        while elapsed < timeout_s:
            # Each tick uses its own short-lived session to avoid
            # holding a connection during the long sleep.
            async with async_session_maker() as session:
                job = await job_queue.get_job(session, job_id)
            if job is None:
                yield _sse_event({"error": "job not found"}, event="error")
                return
            signature = (job.status, job.stage)
            if signature != last_signature:
                yield _sse_event(_job_to_status(job).model_dump(), event="status")
                last_signature = signature
            if job.status in terminal:
                return
            await asyncio.sleep(poll_interval_s)
            elapsed += poll_interval_s
        # Timeout — let the client decide whether to reconnect.
        yield _sse_event({"reason": "timeout"}, event="timeout")

    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",  # nginx: don't buffer
        "Connection": "keep-alive",
    }
    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers=headers,
    )


# ─── POST /jobs/{job_id}/cancel ─────────────────────────────────────────────


@router.post("/jobs/{job_id}/cancel", response_model=JobStatusResponse)
async def cancel_job_route(
    job_id: uuid.UUID,
    _user: User = Depends(get_system_user),
    session: AsyncSession = Depends(get_async_session),
) -> JobStatusResponse:
    """Flip a pending|running job to failed with error='cancelled by user'.

    Already-terminal jobs (succeeded/failed) return their current state
    unchanged with HTTP 200 — cancel is idempotent so the FE's "Cancel"
    button doesn't have to special-case the racy double-click.

    Caveat: the worker doesn't yet check this flag mid-pipeline, so a
    running job's pipeline continues until completion. The result is
    just dropped — `mark_succeeded` gates on status='running' which
    cancel has already left. Surfaces as wasted compute but never
    overwrites the cancel.
    """
    changed = await job_queue.cancel_job(session, job_id=job_id)
    await session.commit()
    job = await job_queue.get_job(session, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    if not changed:
        # Surface the no-op via a header so debuggable but the FE doesn't
        # have to handle a separate response shape.
        # (Body is still a JobStatusResponse so OpenAPI stays consistent.)
        pass
    return _job_to_status(job)
