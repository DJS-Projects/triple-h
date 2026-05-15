"""Extraction queue worker.

Runs as a separate container (docker-compose service `worker`). Polls
the `extraction_job` table for pending rows, claims them atomically via
`FOR UPDATE SKIP LOCKED`, runs `extract_structured`, and writes results
back into `extraction_run` + the originating job row.

Lifecycle per iteration:
  1. claim_next_pending()  → grabs one job, sets status=running, lease.
  2. fetch the document blob + extract_structured()
  3. persist pages + extraction_run
  4. mark_succeeded(job, run_id)  OR  mark_failed(job, error)
  5. sleep IDLE_POLL_SECONDS if no job was claimed; otherwise immediately
     try again (drain the queue before backing off).

A periodic sweeper (every SWEEPER_INTERVAL_S) requeues running jobs
whose lease has expired — those are rows the previous worker
crashed/died on.

Run directly:
    python -m app.worker

Or wired into docker-compose with `command: python -m app.worker`.
"""

from __future__ import annotations

import asyncio
import logging
import signal
import time
import traceback
from collections.abc import Awaitable, Callable
from typing import Any

from app.database import async_session_maker
from app.logging_setup import extraction_id_var, get_logger, request_start_var
from app.models import Document, ExtractionJob
from app.services import job_queue, persistence
from app.services.blob_store import get_blob_store
from app.services.classifier import UnsupportedDocumentError
from app.services.extraction import extract_structured

_log = logging.getLogger("triple_h.worker")
_event = get_logger("triple_h.worker")

# Tuning knobs (env override later if needed).
IDLE_POLL_SECONDS = 2.0  # how long to sleep when the queue is empty
BUSY_BACKOFF_SECONDS = 0.0  # 0 = drain ASAP between successful claims
SWEEPER_INTERVAL_S = 60.0  # requeue stalled jobs once a minute

# Global shutdown flag set by SIGTERM/SIGINT — the main loop checks it
# between iterations so an in-flight pipeline run finishes gracefully.
_shutdown = asyncio.Event()


def _install_signal_handlers(loop: asyncio.AbstractEventLoop) -> None:
    """Trip the shutdown flag on SIGTERM / SIGINT instead of dying mid-job."""
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _shutdown.set)


async def _stage_callback_factory(
    job_id: Any,
) -> Callable[[str], Awaitable[None]]:
    """Build a closure that updates `job.stage` AND polls for cancel.

    Each pipeline stage boundary becomes a cancellation checkpoint:
    we re-read the job row and, if a user cancel has flipped it to
    `failed` with the `cancelled` error sentinel, raise
    `JobCancelledError` to abort the in-flight pipeline. BaseException-
    derived so the pipeline's `except Exception` swallow-wrapper around
    `on_stage` doesn't eat it.

    Why piggy-back on the stage hook instead of a dedicated cancel poll?
    Stages already fire 5-7 times per run (classifying / ocr / anchoring
    / extracting / postprocess / persist), spaced seconds apart — that's
    a reasonable abort cadence without spinning up a separate poll loop.
    Worst case (cancel arrives during the LLM call) we still abort at
    the next stage transition, which is the LLM-completion boundary.
    """

    async def _set_stage(stage: str) -> None:
        async with async_session_maker() as session:
            job = await job_queue.get_job(session, job_id)
            if job is None:
                # Row vanished — treat as cancellation. Avoids the worker
                # ploughing through with no destination row to update.
                raise job_queue.JobCancelledError(
                    f"job {job_id} disappeared mid-pipeline"
                )
            if job.status == "failed" and (job.error or "").startswith("cancelled"):
                raise job_queue.JobCancelledError(
                    f"job {job_id} cancelled by user at stage={stage}"
                )
            await job_queue.update_stage(session, job_id=job_id, stage=stage)
            await session.commit()

    return _set_stage


async def _process_job(job: ExtractionJob) -> None:
    """Run the pipeline for one claimed job. Updates job row on exit.

    Sets the per-extraction ContextVars from `job.job_id` so structlog
    events, OTel root span attributes, and the Langfuse trace_id
    metadata helper all share the same correlation key. Without this,
    the pipeline runs in the worker process with the ContextVars unset
    (TimingMiddleware never fires here — it's HTTP-only) and Langfuse
    falls back to auto-generated per-call trace_ids → ungrouped traces.
    """
    eid_token = extraction_id_var.set(str(job.job_id))
    start_token = request_start_var.set(time.perf_counter())
    set_stage = await _stage_callback_factory(job.job_id)
    blob_store = get_blob_store()

    try:
        # Load the document + raw bytes, and transition its status to
        # `processing` so the FE recent-uploads list shows a live indicator
        # instead of the stale `uploaded` label.
        async with async_session_maker() as session:
            doc = await session.get(Document, job.document_id)
            if doc is None:
                raise RuntimeError(f"document {job.document_id} not found")
            filename = doc.filename
            blob_key = doc.blob_key
            # Only step forward from a pre-extraction state. Don't overwrite
            # `extracted` / `reviewed` on retried runs — those should keep
            # whatever the previous successful run set.
            if doc.status in ("uploaded", "failed"):
                prior_doc_status = doc.status
                doc.status = "processing"
                await session.commit()
                _event.info(
                    "doc_state_transition",
                    document_id=str(doc.document_id),
                    job_id=str(job.job_id),
                    from_status=prior_doc_status,
                    to_status="processing",
                    actor="worker_claim",
                )

        pdf_bytes = await blob_store.get(blob_key)

        await set_stage("pipeline")

        # Run the pipeline. Pipeline writes its own OTel spans + Langfuse
        # traces; the worker stays out of that path.
        #
        # Pass `set_stage` as the on_stage hook so the pipeline writes
        # granular sub-stages (classifying / ocr / anchoring / extracting
        # / postprocess) into job.stage during each phase boundary. The
        # FE's SSE stream picks these up within its 500ms poll cadence
        # and updates the per-row label.
        result = await extract_structured(
            pdf_bytes,
            filename,
            doc_type=job.doc_type,  # type: ignore[arg-type]
            model=job.model,
            dpi=job.request_meta.get("dpi", 150)
            if isinstance(job.request_meta, dict)
            else 150,
            on_stage=set_stage,
        )

        await set_stage("persist")

        async with async_session_maker() as session:
            doc = await session.get(Document, job.document_id)
            if doc is None:
                raise RuntimeError(f"document {job.document_id} vanished mid-run")
            await persistence.record_pages(
                session,
                blob_store=blob_store,
                document=doc,
                pages=[
                    (p.page_no, p.width_px, p.height_px, p.png_bytes)
                    for p in result.pages
                ],
            )
            extraction_payload: dict[str, Any] = {
                "extracted": result.extracted,
                "markdown": result.markdown,
                "docling_doc": result.docling_doc,
                "chandra_chunks": result.chandra_chunks,
                "pipeline_variant": result.pipeline_variant,
                "envelope": result.envelope.model_dump() if result.envelope else None,
            }
            run = await persistence.record_extraction_run(
                session,
                document=doc,
                doc_type=result.doc_type,
                llm_model=result.model,
                checkpoint_id=result.checkpoint_id,
                duration_ms=result.duration_ms,
                payload=extraction_payload,
            )
            await job_queue.mark_succeeded(
                session, job_id=job.job_id, run_id=run.extraction_run_id
            )
            await session.commit()

        _log.info(
            "job %s succeeded run=%s duration_ms=%s",
            job.job_id,
            run.extraction_run_id,
            result.duration_ms,
        )
    except UnsupportedDocumentError as exc:
        # Classifier rejected the upload as off-distribution (not one of
        # delivery_order / weighing_bill / invoice / petrol_bill). Mark
        # the job failed with a specific sentinel prefix the FE keys on
        # to render a friendly "rejected" UI and auto-clean the document.
        # Logged at info (not error) — this is the system working as
        # designed, not a fault.
        sentinel = f"unsupported document type: {exc.reasoning}"
        _log.info("job %s rejected as unsupported: %s", job.job_id, exc.reasoning)
        _event.info(
            "job_rejected_unsupported_document",
            job_id=str(job.job_id),
            document_id=str(job.document_id),
            reasoning=exc.reasoning,
        )
        try:
            async with async_session_maker() as session:
                await job_queue.mark_failed(session, job_id=job.job_id, error=sentinel)
                # Flip doc.status from `processing` → `rejected` so the
                # FE renders the dedicated rejection state (with the
                # classifier's reasoning + Retry-as picker) rather than
                # the misleading "queued" spinner that `uploaded`
                # produced before this terminal state existed.
                rejected_doc = await session.get(Document, job.document_id)
                if rejected_doc is not None and rejected_doc.status == "processing":
                    rejected_doc.status = "rejected"
                    _event.info(
                        "doc_state_transition",
                        document_id=str(job.document_id),
                        job_id=str(job.job_id),
                        from_status="processing",
                        to_status="rejected",
                        actor="classifier_reject",
                    )
                await session.commit()
        except Exception:  # noqa: BLE001
            _log.exception("follow-up cleanup for rejected job %s failed", job.job_id)
        return
    except job_queue.JobCancelledError as exc:
        # Cooperative cancellation: user cancel landed mid-pipeline and the
        # next stage boundary tripped this. No mark_failed (the cancel
        # route already set status=failed). No doc.status update (cancel
        # already reset processing → uploaded). No persist of partial work.
        # Just log at info — this is the happy-path for cancel, not an
        # error condition.
        _log.info("job %s cancelled mid-pipeline: %s", job.job_id, exc)
        _event.info(
            "job_pipeline_aborted",
            job_id=str(job.job_id),
            document_id=str(job.document_id),
            reason="user_cancel",
        )
        return
    except Exception as exc:  # noqa: BLE001 — log + mark failed, don't crash worker
        tb = traceback.format_exc()
        _log.error(
            "job %s FAILED: %s\n%s",
            job.job_id,
            exc,
            tb,
        )
        try:
            async with async_session_maker() as session:
                await job_queue.mark_failed(
                    session,
                    job_id=job.job_id,
                    error=f"{type(exc).__name__}: {exc}",
                )
                # Mirror the failure onto the document so the FE recent-
                # uploads row shows a clear error state instead of the
                # stale `processing` label from the claim transition.
                # Don't downgrade `extracted` / `reviewed` — those came
                # from an earlier successful run that's still valid.
                failed_doc = await session.get(Document, job.document_id)
                if failed_doc is not None and failed_doc.status == "processing":
                    failed_doc.status = "failed"
                    _event.info(
                        "doc_state_transition",
                        document_id=str(job.document_id),
                        job_id=str(job.job_id),
                        from_status="processing",
                        to_status="failed",
                        actor="worker_error",
                        error_type=type(exc).__name__,
                    )
                await session.commit()
        except Exception:  # noqa: BLE001
            _log.exception("follow-up mark_failed for job %s also failed", job.job_id)
    finally:
        # Reset ContextVars so the next iteration of the claim loop
        # doesn't see stale values if it doesn't enter _process_job
        # (idle ticks, sweeper-only iterations).
        extraction_id_var.reset(eid_token)
        request_start_var.reset(start_token)


async def _claim_loop() -> None:
    """Main claim → process → repeat loop. Exits on shutdown flag."""
    while not _shutdown.is_set():
        async with async_session_maker() as session:
            job = await job_queue.claim_next_pending(session)
            await session.commit()
        if job is None:
            try:
                await asyncio.wait_for(_shutdown.wait(), timeout=IDLE_POLL_SECONDS)
            except asyncio.TimeoutError:
                pass
            continue
        await _process_job(job)
        if BUSY_BACKOFF_SECONDS > 0:
            await asyncio.sleep(BUSY_BACKOFF_SECONDS)


async def _sweeper_loop() -> None:
    """Periodically requeue jobs whose worker lease has expired."""
    while not _shutdown.is_set():
        try:
            async with async_session_maker() as session:
                n = await job_queue.requeue_stalled(session)
                await session.commit()
            if n:
                _log.warning("sweeper requeued %d stalled job(s)", n)
        except Exception:  # noqa: BLE001
            _log.exception("sweeper iteration failed; continuing")
        try:
            await asyncio.wait_for(_shutdown.wait(), timeout=SWEEPER_INTERVAL_S)
        except asyncio.TimeoutError:
            pass


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(name)s] %(levelname)s %(message)s",
    )
    _log.info("extraction worker starting")
    loop = asyncio.get_running_loop()
    _install_signal_handlers(loop)
    await asyncio.gather(_claim_loop(), _sweeper_loop())
    _log.info("extraction worker exiting cleanly")


if __name__ == "__main__":
    asyncio.run(main())
