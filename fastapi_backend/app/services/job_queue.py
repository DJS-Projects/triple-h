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
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, or_, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.logging_setup import get_logger
from app.models import Document, ExtractionJob

_log = logging.getLogger(__name__)
_event = get_logger("triple_h.job_queue")


# BaseException (not Exception) on purpose — the pipeline wraps its
# `on_stage` hook in `except Exception` to keep observability bugs
# from killing extraction. Cooperative cancellation must propagate
# *through* that wrapper, so we use the same trick asyncio.CancelledError
# uses (BaseException-derived) to bypass narrow `except Exception` nets.
class JobCancelledError(BaseException):
    """Signal that the worker should abort the in-flight pipeline.

    Raised from inside the stage-progress callback when a freshly read
    job row reveals a user cancel has landed. The worker's outer handler
    catches this distinctly from regular pipeline failures: cancel has
    already flipped the row to `failed` and reset doc.status, so the
    handler must NOT call mark_failed (would no-op anyway, but the
    logged "FAILED" event would be misleading).
    """


# Worker lease window — claim sets locked_until=NOW()+this; sweeper
# requeues anything stuck longer. 180s (3 min) is comfortable headroom
# over a ~60-90s freight-doc extraction; tune up only if you genuinely
# run multi-minute pipelines. Shorter lease = faster recovery when the
# worker crashes or hangs mid-run.
#
# Override via env (EXTRACTION_LEASE_SECONDS=300 mise docker:up) for
# experiments without a code change.
def _lease_from_env() -> int:
    raw = os.getenv("EXTRACTION_LEASE_SECONDS")
    if raw is None:
        return 180
    try:
        parsed = int(raw)
    except ValueError:
        _log.warning(
            "EXTRACTION_LEASE_SECONDS=%r is not an int; falling back to default 180s",
            raw,
        )
        return 180
    if parsed < 30:
        _log.warning(
            "EXTRACTION_LEASE_SECONDS=%d too low (<30s); clamping to 30s", parsed
        )
        return 30
    return parsed


DEFAULT_LEASE_SECONDS = _lease_from_env()


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
        _event.info(
            "job_state_transition",
            job_id=str(job.job_id),
            document_id=str(job.document_id),
            from_status="pending",
            to_status="running",
            actor="worker_claim",
            attempt=job.attempts,
            lease_seconds=lease_seconds,
        )
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
    """Transition running → succeeded with the produced run_id.

    Idempotent: silently misses if the row isn't currently 'running'
    (cancelled or already terminal). The rowcount check tells us
    whether to emit the transition event — no event on a no-op.
    """
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
    result = await session.execute(stmt)
    rowcount = getattr(result, "rowcount", 0) or 0
    if int(rowcount) > 0:
        _event.info(
            "job_state_transition",
            job_id=str(job_id),
            from_status="running",
            to_status="succeeded",
            actor="worker_complete",
            run_id=run_id,
        )


async def mark_failed(
    session: AsyncSession,
    *,
    job_id: uuid.UUID,
    error: str,
) -> None:
    """Transition running → failed with an error message.

    Idempotent: silently misses when the row isn't 'running' (e.g.
    already cancelled). Event emission gated on rowcount so a no-op
    doesn't generate a misleading "transition" log.
    """
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
    result = await session.execute(stmt)
    rowcount = getattr(result, "rowcount", 0) or 0
    if int(rowcount) > 0:
        _event.info(
            "job_state_transition",
            job_id=str(job_id),
            from_status="running",
            to_status="failed",
            actor="worker_error",
            error_preview=truncated[:200],
        )


async def list_recent_jobs(
    session: AsyncSession,
    *,
    limit: int = 50,
    statuses: tuple[str, ...] | None = None,
) -> list[ExtractionJob]:
    """List recent jobs, newest-first, optionally filtered by status.

    Used by the FE queue panel to hydrate across page refreshes: any job
    the worker has touched in this DB row exists here regardless of
    client state.
    """
    stmt = select(ExtractionJob).order_by(ExtractionJob.created_at.desc())
    if statuses:
        stmt = stmt.where(ExtractionJob.status.in_(statuses))
    stmt = stmt.limit(max(1, min(limit, 200)))
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def cancel_job(
    session: AsyncSession,
    *,
    job_id: uuid.UUID,
) -> bool:
    """Transition pending|running → failed AND reset doc.status if needed.

    Returns True if a state change actually occurred. Already-terminal
    jobs (succeeded / failed) are no-ops and return False.

    Two-step transition:
      1. Flip extraction_job: pending|running → failed (error='cancelled by user')
      2. If the worker had advanced the document to 'processing', reset it
         to 'uploaded' so the FE sees an idle, re-submittable doc rather
         than a stuck "processing" indicator. Documents in other states
         (extracted / reviewed / failed) are NOT touched — they reflect
         prior runs that the cancel doesn't invalidate.

    Concurrency: `mark_succeeded` and `mark_failed` both gate on
    `status='running'`, so a worker racing toward completion can't
    overwrite the cancel — the worker's update_stage / mark_* calls
    silently miss zero rows and the pipeline result is dropped on the
    floor.

    Note: the pipeline itself isn't aborted — it runs to completion in
    the worker, the result just doesn't get persisted. Co-operative
    cancellation mid-pipeline is a follow-up.
    """
    # Step 1: flip the job. Capture (document_id, prior_status) from the
    # row so we can reset doc status next AND emit a precise transition
    # event. RETURNING avoids a separate SELECT.
    #
    # `extraction_job.status` is read POST-update by RETURNING, so we
    # subquery for the prior status before the UPDATE lands. Simpler:
    # read prior status via SELECT first since cancels are rare.
    prior = await session.execute(
        select(ExtractionJob.status, ExtractionJob.document_id).where(
            ExtractionJob.job_id == job_id
        )
    )
    prior_row = prior.first()
    if prior_row is None:
        return False
    prior_status, doc_id = prior_row

    stmt = (
        update(ExtractionJob)
        .where(
            and_(
                ExtractionJob.job_id == job_id,
                ExtractionJob.status.in_(("pending", "running")),
            )
        )
        .values(
            status="failed",
            error="cancelled by user",
            finished_at=datetime.now(timezone.utc),
            locked_until=None,
        )
        .execution_options(synchronize_session="fetch")
    )
    result = await session.execute(stmt)
    rowcount = getattr(result, "rowcount", 0) or 0
    if int(rowcount) == 0:
        return False

    # Step 2: unstick the document if the worker had marked it 'processing'.
    # Idempotent UPDATE — only touches rows currently in 'processing'.
    doc_reset = await session.execute(
        update(Document)
        .where(
            and_(
                Document.document_id == doc_id,
                Document.status == "processing",
            )
        )
        .values(status="uploaded")
        .execution_options(synchronize_session="fetch")
    )
    doc_status_changed = int(getattr(doc_reset, "rowcount", 0) or 0) > 0

    _event.info(
        "job_state_transition",
        job_id=str(job_id),
        document_id=str(doc_id),
        from_status=prior_status,
        to_status="failed",
        actor="user_cancel",
        doc_status_reset=doc_status_changed,
    )
    return True


async def requeue_stalled(
    session: AsyncSession,
) -> int:
    """Find running jobs whose lease has expired and return them to pending.

    Returns the number of jobs requeued. Called periodically by the
    worker's sweeper loop. Stalled = `locked_until < NOW()` AND status
    is still 'running' (worker crashed before transitioning).

    Emits one event per requeue with the job_id so an operator can
    see which jobs the sweeper touched. RETURNING avoids a separate
    SELECT for the affected ids.
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
        .returning(ExtractionJob.job_id)
        .execution_options(synchronize_session="fetch")
    )
    result = await session.execute(stmt)
    requeued_ids = [str(row[0]) for row in result.fetchall()]
    for jid in requeued_ids:
        _event.info(
            "job_state_transition",
            job_id=jid,
            from_status="running",
            to_status="pending",
            actor="sweeper_requeue",
        )
    return len(requeued_ids)
