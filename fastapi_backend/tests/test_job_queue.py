"""Tests for the extraction job queue service.

Coverage:
* idempotency on (idempotency_key) collisions
* idempotency on (content_hash, model, doc_type) collisions
* claim_next_pending is atomic + returns FIFO order
* state transitions: stage / succeeded / failed
* requeue_stalled finds expired leases

Read-after-write pattern: tests call `_refetch(session, job_id)` instead
of `session.get(...)` after raw-SQL/ORM updates. `session.get` returns
the identity-map cached row, which after expire_all may trigger a
sync lazy-load inside the async session and crash with MissingGreenlet.
A direct `select()` query is the async-safe way to read fresh state.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document, ExtractionJob, ExtractionRun, User
from app.services.job_queue import (
    cancel_job,
    create_or_get_job,
    claim_next_pending,
    mark_failed,
    mark_succeeded,
    requeue_stalled,
    update_stage,
)


async def _refetch(session: AsyncSession, job_id: uuid.UUID) -> ExtractionJob | None:
    """Async-safe read of a job by id, bypassing the session identity map."""
    stmt = select(ExtractionJob).where(ExtractionJob.job_id == job_id)
    return (await session.execute(stmt)).scalar_one_or_none()


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="job-test@example.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_document(db_session: AsyncSession, test_user: User) -> Document:
    doc = Document(
        uploaded_by=test_user.id,
        filename="test.pdf",
        mime_type="application/pdf",
        size_bytes=100,
        blob_key="documents/test",
        sha256="a" * 64,
    )
    db_session.add(doc)
    await db_session.commit()
    await db_session.refresh(doc)
    return doc


# ─── create_or_get_job: idempotency ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_job_returns_created_true_for_fresh_row(
    db_session: AsyncSession, test_document: Document
) -> None:
    result = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="key-1",
        content_hash=test_document.sha256,
        model="groq-llama4-scout",
        doc_type="delivery_order",
    )
    await db_session.commit()
    assert result.created is True
    assert result.job.status == "pending"
    assert result.job.idempotency_key == "key-1"


@pytest.mark.asyncio
async def test_same_idempotency_key_returns_existing_job(
    db_session: AsyncSession, test_document: Document
) -> None:
    """Active job with same key → return it, don't create new."""
    first = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="dup-key",
        content_hash=test_document.sha256,
        model="groq-llama4-scout",
        doc_type="delivery_order",
    )
    await db_session.commit()

    second = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="dup-key",
        content_hash=test_document.sha256,
        model="groq-llama4-scout",
        doc_type="delivery_order",
    )
    await db_session.commit()

    assert first.created is True
    assert second.created is False
    assert second.job.job_id == first.job.job_id


@pytest.mark.asyncio
async def test_same_content_model_doc_type_dedups_without_idem_key(
    db_session: AsyncSession, test_document: Document
) -> None:
    """Different idempotency keys but same (content, model, doc_type) → dedup."""
    first = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="key-A",
        content_hash="hash-x",
        model="groq-llama4-scout",
        doc_type="delivery_order",
    )
    await db_session.commit()

    second = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="key-B",  # different idem key
        content_hash="hash-x",  # same content
        model="groq-llama4-scout",
        doc_type="delivery_order",
    )
    await db_session.commit()

    assert second.created is False
    assert second.job.job_id == first.job.job_id


@pytest.mark.asyncio
async def test_different_model_creates_new_job_for_same_content(
    db_session: AsyncSession, test_document: Document
) -> None:
    """Same content + different model → different jobs allowed."""
    first = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="key-1",
        content_hash="hash-y",
        model="groq-llama4-scout",
        doc_type="delivery_order",
    )
    await db_session.commit()

    second = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="key-2",
        content_hash="hash-y",
        model="gemma-4-31b",  # different model
        doc_type="delivery_order",
    )
    await db_session.commit()

    assert first.job.job_id != second.job.job_id


@pytest.mark.asyncio
async def test_failed_job_does_not_block_resubmit(
    db_session: AsyncSession, test_document: Document
) -> None:
    """After a failed job, a new submission with the same key creates a fresh row."""
    first = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="retry-key",
        content_hash="hash-z",
        model="groq-llama4-scout",
        doc_type="delivery_order",
    )
    await db_session.commit()

    # Manually move to running then failed (the dedup index only blocks
    # active states; failed is terminal and re-submittable).
    await claim_next_pending(db_session)
    await mark_failed(db_session, job_id=first.job.job_id, error="simulated failure")
    await db_session.commit()

    second = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="retry-key",
        content_hash="hash-z",
        model="groq-llama4-scout",
        doc_type="delivery_order",
    )
    await db_session.commit()

    assert second.created is True
    assert second.job.job_id != first.job.job_id


# ─── claim_next_pending ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_claim_returns_none_when_empty(db_session: AsyncSession) -> None:
    job = await claim_next_pending(db_session)
    assert job is None


@pytest.mark.asyncio
async def test_claim_transitions_pending_to_running(
    db_session: AsyncSession, test_document: Document
) -> None:
    created = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="claim-1",
        content_hash="hash-c1",
        model="m",
        doc_type=None,
    )
    await db_session.commit()
    assert created.job.status == "pending"

    claimed = await claim_next_pending(db_session)
    await db_session.commit()
    assert claimed is not None
    assert claimed.job_id == created.job.job_id
    assert claimed.status == "running"
    assert claimed.started_at is not None
    assert claimed.attempts == 1
    assert claimed.locked_until is not None


@pytest.mark.asyncio
async def test_claim_does_not_pick_running_jobs(
    db_session: AsyncSession, test_document: Document
) -> None:
    """Once claimed, a job is invisible to the next claim until done/failed/requeue."""
    await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="claim-2",
        content_hash="hash-c2",
        model="m",
        doc_type=None,
    )
    await db_session.commit()
    await claim_next_pending(db_session)
    await db_session.commit()
    second = await claim_next_pending(db_session)
    assert second is None


# ─── State transitions ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_stage_only_writes_when_running(
    db_session: AsyncSession, test_document: Document
) -> None:
    created = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="stage-1",
        content_hash="hash-s1",
        model="m",
        doc_type=None,
    )
    await db_session.commit()

    # Before claim → still pending → update_stage must NOT write.
    await update_stage(db_session, job_id=created.job.job_id, stage="oops")
    await db_session.commit()
    job = await _refetch(db_session, created.job.job_id)
    assert job is not None and job.stage is None

    # After claim → running → update_stage writes.
    await claim_next_pending(db_session)
    await update_stage(db_session, job_id=created.job.job_id, stage="chandra")
    await db_session.commit()
    job = await _refetch(db_session, created.job.job_id)
    assert job is not None and job.stage == "chandra"


@pytest.mark.asyncio
async def test_mark_succeeded_writes_run_id_and_clears_lease(
    db_session: AsyncSession, test_document: Document
) -> None:
    # Need a real extraction_run for the FK to be satisfied.
    run = ExtractionRun(
        document_id=test_document.document_id,
        doc_type="delivery_order",
        schema_version="extraction.v1",
        llm_model="m",
        duration_ms=100,
        payload={"extracted": {}},
    )
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)

    created = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="ok-1",
        content_hash="hash-o1",
        model="m",
        doc_type=None,
    )
    await db_session.commit()
    await claim_next_pending(db_session)
    await mark_succeeded(
        db_session, job_id=created.job.job_id, run_id=run.extraction_run_id
    )
    await db_session.commit()

    job = await _refetch(db_session, created.job.job_id)
    assert job is not None
    assert job.status == "succeeded"
    assert job.run_id == run.extraction_run_id
    assert job.finished_at is not None
    assert job.locked_until is None


@pytest.mark.asyncio
async def test_mark_failed_truncates_long_errors(
    db_session: AsyncSession, test_document: Document
) -> None:
    created = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="fail-1",
        content_hash="hash-f1",
        model="m",
        doc_type=None,
    )
    await db_session.commit()
    await claim_next_pending(db_session)
    huge_error = "x" * 5000
    await mark_failed(db_session, job_id=created.job.job_id, error=huge_error)
    await db_session.commit()

    job = await _refetch(db_session, created.job.job_id)
    assert job is not None
    assert job.status == "failed"
    assert job.error is not None and len(job.error) <= 2000


# ─── Sweeper ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_requeue_stalled_returns_running_to_pending(
    db_session: AsyncSession, test_document: Document
) -> None:
    """Worker died mid-job → lease expired → sweeper requeues."""
    created = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="stall-1",
        content_hash="hash-st1",
        model="m",
        doc_type=None,
    )
    await db_session.commit()
    claimed = await claim_next_pending(db_session)
    assert claimed is not None
    # Backdate the lease to before now → sweeper should find it.
    claimed.locked_until = datetime.now(timezone.utc) - timedelta(minutes=5)
    await db_session.commit()

    n = await requeue_stalled(db_session)
    await db_session.commit()
    assert n == 1

    job = await _refetch(db_session, created.job.job_id)
    assert job is not None
    assert job.status == "pending"
    assert job.locked_until is None


@pytest.mark.asyncio
async def test_requeue_skips_fresh_leases(
    db_session: AsyncSession, test_document: Document
) -> None:
    """Sweeper must NOT requeue a worker that's still inside its lease window."""
    await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="fresh-1",
        content_hash="hash-fr1",
        model="m",
        doc_type=None,
    )
    await db_session.commit()
    await claim_next_pending(db_session)
    await db_session.commit()

    n = await requeue_stalled(db_session)
    assert n == 0


# ─── cancel_job ──────────────────────────────────────────────────────────────


async def _refetch_doc(session: AsyncSession, doc_id: uuid.UUID) -> Document | None:
    """Async-safe read of a document, bypassing identity map (mirror of _refetch)."""
    stmt = select(Document).where(Document.document_id == doc_id)
    return (await session.execute(stmt)).scalar_one_or_none()


@pytest.mark.asyncio
async def test_cancel_pending_job_flips_job_only(
    db_session: AsyncSession, test_document: Document
) -> None:
    """Cancelling a pending job: job → failed, doc still 'uploaded' (worker never touched it)."""
    created = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="cancel-p1",
        content_hash="hash-cp1",
        model="m",
        doc_type=None,
    )
    await db_session.commit()

    changed = await cancel_job(db_session, job_id=created.job.job_id)
    await db_session.commit()
    assert changed is True

    job = await _refetch(db_session, created.job.job_id)
    doc = await _refetch_doc(db_session, test_document.document_id)
    assert job is not None and doc is not None
    assert job.status == "failed"
    assert job.error == "cancelled by user"
    assert doc.status == "uploaded"  # worker never claimed; nothing to reset


@pytest.mark.asyncio
async def test_cancel_running_job_resets_doc_status(
    db_session: AsyncSession, test_document: Document
) -> None:
    """Cancelling a running job: job → failed AND doc 'processing' → 'uploaded'.

    Mirrors the real bug: user cancels while worker is mid-pipeline. Before
    the fix, doc.status stayed 'processing' forever; now it resets so the FE
    can re-submit.
    """
    await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="cancel-r1",
        content_hash="hash-cr1",
        model="m",
        doc_type=None,
    )
    await db_session.commit()
    claimed = await claim_next_pending(db_session)
    await db_session.commit()
    assert claimed is not None

    # Simulate the worker's status transition.
    test_document.status = "processing"
    await db_session.commit()

    changed = await cancel_job(db_session, job_id=claimed.job_id)
    await db_session.commit()
    assert changed is True

    job = await _refetch(db_session, claimed.job_id)
    doc = await _refetch_doc(db_session, test_document.document_id)
    assert job is not None and doc is not None
    assert job.status == "failed"
    assert doc.status == "uploaded"


@pytest.mark.asyncio
async def test_cancel_does_not_clobber_extracted_doc(
    db_session: AsyncSession, test_document: Document
) -> None:
    """Cancel must NOT downgrade a doc that already finished an earlier run.

    Scenario: doc was extracted on run #1, then a new run #2 was submitted
    and is pending; user cancels run #2. The doc.status='extracted' from
    run #1 stays — cancel only resets 'processing' rows.
    """
    test_document.status = "extracted"
    await db_session.commit()

    created = await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="cancel-x1",
        content_hash="hash-cx1",
        model="m",
        doc_type=None,
    )
    await db_session.commit()

    changed = await cancel_job(db_session, job_id=created.job.job_id)
    await db_session.commit()
    assert changed is True

    doc = await _refetch_doc(db_session, test_document.document_id)
    assert doc is not None
    assert doc.status == "extracted"  # untouched


@pytest.mark.asyncio
async def test_cancel_terminal_job_is_noop(
    db_session: AsyncSession, test_document: Document
) -> None:
    """Already-failed jobs return False from cancel; doc untouched.

    mark_failed only fires on 'running' rows, so claim first to reach a
    state where mark_failed can land — otherwise the job stays 'pending'
    and cancel would happily flip it.
    """
    await create_or_get_job(
        db_session,
        document_id=test_document.document_id,
        idempotency_key="cancel-t1",
        content_hash="hash-ct1",
        model="m",
        doc_type=None,
    )
    await db_session.commit()
    claimed = await claim_next_pending(db_session)
    await db_session.commit()
    assert claimed is not None
    await mark_failed(db_session, job_id=claimed.job_id, error="boom")
    await db_session.commit()

    changed = await cancel_job(db_session, job_id=claimed.job_id)
    assert changed is False
