"""Postgres-backed extraction job queue.

Async helpers for the `extraction_job` table:

* `create_or_get_job` — idempotency-aware insert. Returns the existing
  active job when (idempotency_key) or (content_hash, model, doc_type)
  collide; creates a new row otherwise.

* `claim_next_pending` — atomic FIFO claim using `FOR UPDATE SKIP LOCKED`.
  Workers call this in a loop; each call returns at most one job and is
  safe under concurrent workers.

* `update_stage`, `mark_succeeded`, `mark_failed` — terminal/progress
  transitions invoked by the worker. Idempotent at the SQL level.

* `requeue_stalled` — sweeper for jobs whose lease (`locked_until`)
  expired without completion. Returns them to pending so another worker
  can pick them up.

The route + worker layers stay free of SQL: this module is the only
file that knows about job table internals.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, or_, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ExtractionJob

_log = logging.getLogger(__name__)

# Worker lease window — claim sets locked_until=NOW()+this; sweeper
# requeues anything stuck longer.
DEFAULT_LEASE_SECONDS = 600  # 10 min — covers a slow LLM run with headroom


@dataclass(frozen=True)
class JobCreateResult:
    """Result of `create_or_get_job` — explicit about reuse vs creation."""

    job: ExtractionJob
    created: bool  # True = fresh row; False = reused existing active job


async def create_or_get_job(
    session: AsyncSession,
    *,
    document_id: uuid.UUID,
    idempotency_key: str,
    content_hash: str,
    model: str,
    doc_type: str | None,
    request_meta: dict[str, Any] | None = None,
    max_attempts: int = 1,
) -> JobCreateResult:
    """Insert a job, or return the existing active one if dedup hits.

    Dedup order (tightest first):
      1. idempotency_key (active states only)
      2. (content_hash, model, COALESCE(doc_type, 'auto'))  — defensive

    Both checks happen via partial unique indexes; we attempt the insert
    and catch IntegrityError, then re-query for the winning row. This is
    the canonical "upsert by partial unique" pattern and avoids the
    race window of pre-check-then-insert.
    """
    job = ExtractionJob(
        document_id=document_id,
        idempotency_key=idempotency_key,
        content_hash=content_hash,
        model=model,
        doc_type=doc_type,
        request_meta=request_meta or {},
        max_attempts=max_attempts,
    )
    session.add(job)
    try:
        await session.flush()
        return JobCreateResult(job=job, created=True)
    except IntegrityError:
        # One of the partial-unique indexes blocked us. Roll back the
        # failed insert and look up whichever active row beat us.
        await session.rollback()
        existing = await _find_active_by_idem_or_content(
            session,
            idempotency_key=idempotency_key,
            content_hash=content_hash,
            model=model,
            doc_type=doc_type,
        )
        if existing is None:
            # IntegrityError without a winning row → re-raise. Means
            # something else (FK?) failed; we shouldn't swallow it.
            raise
        return JobCreateResult(job=existing, created=False)


async def _find_active_by_idem_or_content(
    session: AsyncSession,
    *,
    idempotency_key: str,
    content_hash: str,
    model: str,
    doc_type: str | None,
) -> ExtractionJob | None:
    """Lookup the active row that won an idempotency collision."""
    active_states = ("pending", "running", "succeeded")
    stmt = (
        select(ExtractionJob)
        .where(
            and_(
                ExtractionJob.status.in_(active_states),
                or_(
                    ExtractionJob.idempotency_key == idempotency_key,
                    and_(
                        ExtractionJob.content_hash == content_hash,
                        ExtractionJob.model == model,
                        # NULL-safe comparison: treat NULLs as equal.
                        ExtractionJob.doc_type.is_not_distinct_from(doc_type),
                    ),
                ),
            )
        )
        .order_by(ExtractionJob.created_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_job(session: AsyncSession, job_id: uuid.UUID) -> ExtractionJob | None:
    """Fetch a single job by id, no-op if missing."""
    return await session.get(ExtractionJob, job_id)


async def claim_next_pending(
    session: AsyncSession,
    *,
    lease_seconds: int = DEFAULT_LEASE_SECONDS,
) -> ExtractionJob | None:
    """Atomically claim the oldest pending job for this worker.

    Returns None when the queue is empty. Concurrent worker calls are
    safe — `FOR UPDATE SKIP LOCKED` ensures each pending row is taken
    by at most one caller.
    """
    # CTE-based update for atomic claim. SQLAlchemy doesn't have a
    # clean Core helper for SKIP LOCKED + UPDATE-RETURNING, so this is
    # raw SQL — explicit and correct.
    lock_until = datetime.now(timezone.utc) + timedelta(seconds=lease_seconds)
    sql = text(
        """
        WITH next_job AS (
            SELECT job_id FROM extraction_job
            WHERE status = 'pending'
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        UPDATE extraction_job
        SET status = 'running',
            started_at = NOW(),
            attempts = attempts + 1,
            locked_until = :lock_until
        FROM next_job
        WHERE extraction_job.job_id = next_job.job_id
        RETURNING extraction_job.job_id
        """
    )
    result = await session.execute(sql, {"lock_until": lock_until})
    row = result.first()
    if row is None:
        return None
    # Raw SQL bypasses the ORM identity map; expire any cached copy so
    # the re-fetch reads the post-update row (status='running', etc.).
    job = await session.get(ExtractionJob, row[0])
    if job is not None:
        await session.refresh(job)
    return job


async def update_stage(session: AsyncSession, *, job_id: uuid.UUID, stage: str) -> None:
    """Worker-side progress update. Only writes when status='running'.

    Defensive: a stale worker that's lost its lease shouldn't overwrite
    stage on a job another worker has taken over.
    """
    stmt = (
        update(ExtractionJob)
        .where(
            and_(
                ExtractionJob.job_id == job_id,
                ExtractionJob.status == "running",
            )
        )
        .values(stage=stage)
        .execution_options(synchronize_session="fetch")
    )
    await session.execute(stmt)


async def mark_succeeded(
    session: AsyncSession,
    *,
    job_id: uuid.UUID,
    run_id: int,
) -> None:
    """Transition running → succeeded with the produced run_id."""
    stmt = (
        update(ExtractionJob)
        .where(
            and_(
                ExtractionJob.job_id == job_id,
                ExtractionJob.status == "running",
            )
        )
        .values(
            status="succeeded",
            run_id=run_id,
            finished_at=datetime.now(timezone.utc),
            locked_until=None,
            error=None,
        )
        .execution_options(synchronize_session="fetch")
    )
    await session.execute(stmt)


async def mark_failed(
    session: AsyncSession,
    *,
    job_id: uuid.UUID,
    error: str,
) -> None:
    """Transition running → failed with an error message."""
    # Truncate to keep audit rows bounded; full trace goes to OTel.
    truncated = error[:2000]
    stmt = (
        update(ExtractionJob)
        .where(
            and_(
                ExtractionJob.job_id == job_id,
                ExtractionJob.status == "running",
            )
        )
        .values(
            status="failed",
            error=truncated,
            finished_at=datetime.now(timezone.utc),
            locked_until=None,
        )
        .execution_options(synchronize_session="fetch")
    )
    await session.execute(stmt)


async def requeue_stalled(
    session: AsyncSession,
) -> int:
    """Find running jobs whose lease has expired and return them to pending.

    Returns the number of jobs requeued. Called periodically by the
    worker's sweeper loop. Stalled = `locked_until < NOW()` AND status
    is still 'running' (worker crashed before transitioning).
    """
    stmt = (
        update(ExtractionJob)
        .where(
            and_(
                ExtractionJob.status == "running",
                ExtractionJob.locked_until.is_not(None),
                ExtractionJob.locked_until < datetime.now(timezone.utc),
            )
        )
        .values(
            status="pending",
            locked_until=None,
            stage=None,
        )
        .execution_options(synchronize_session="fetch")
    )
    result = await session.execute(stmt)
    # session.execute() on an UPDATE returns a CursorResult exposing
    # .rowcount, but the stubs widen this to Result[Any]. Pull via getattr
    # to keep mypy happy without a runtime cast.
    rowcount = getattr(result, "rowcount", 0) or 0
    return int(rowcount)
