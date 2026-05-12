# ADR 0009: Postgres-backed async job queue (no Redis/Celery/SQS)

- **Status:** Inferred — pending confirmation
- **Date:** 2026-04 (best estimate, commit `08129f9` "postgres-backed job queue with idempotency")
- **Decider:** DarrenSJZ (sole maintainer)

## Context

The extraction pipeline runs in the 30–200 second range per document
(Chandra OCR upload + poll, pdf2image render, Docling dump, multi-stage
LLM agent runs over the LiteLLM proxy). That is well past any reasonable
HTTP timeout, so submission must be asynchronous: the FE uploads, gets a
job id, and polls/streams for status until the result is ready.

The queue layer needs:

- **Idempotency** — accidental double-submits from the FE (retry, double
  click, network blip) must not produce two extractions.
- **At-most-once claim across N workers** — when the worker count scales
  past one, two workers must never claim the same job.
- **Crash recovery** — if a worker dies mid-job, the job has to become
  reclaimable by another worker, not lost.
- **Status surface for the FE** — submitted, claimed, running, succeeded,
  failed, with progress signal.

A separate broker (Redis + Celery, RabbitMQ, SQS) is the textbook
choice. The cost is a second piece of stateful infra to operate, a
separate failure mode to reason about, and a separate observability
surface — for a solo-dev project this overhead matters.

## Decision

Implement the queue **inside the application Postgres**. The
`extraction_job` table is the queue. Workers claim work with
`SELECT ... FOR UPDATE SKIP LOCKED` — Postgres guarantees atomic
single-claim across concurrent workers without an external lock service.

Key mechanics:

- An `Idempotency-Key` header on the submission endpoint dedupes
  identical requests at the API boundary.
- A lease field (`lease_expires_at`) makes claims time-bounded; a sweeper
  task requeues jobs whose lease has expired so a crashed worker's job
  becomes reclaimable.
- The worker service (`worker` in `docker-compose.yml`) shares the
  backend image but runs `python -m app.worker`. Multiple replicas are
  safe by construction thanks to `FOR UPDATE SKIP LOCKED` in
  `job_queue.claim_next_pending`.
- Job state changes feed an SSE stream so the FE sees status updates
  without polling.

## Consequences

- One fewer piece of infra to run and reason about. Local dev,
  staging, and prod stay simple: Postgres + workers, no Redis cluster.
- Job state is **transactionally consistent** with extraction data —
  no two-system invariants to reconcile (e.g. "job marked done in
  Redis but result row never committed").
- Backpressure, retries, idempotency, and audit history all share the
  same Postgres + OTel observability stack — one place to look.
- Horizontal scaling is bounded by the Postgres connection budget and
  the `SKIP LOCKED` throughput ceiling. For the per-document latency
  profile (30–200s), this ceiling is far above expected load. If
  throughput requirements shift to thousands of fast jobs per second,
  re-evaluate.
- The worker pod and the backend pod must agree on the schema; Alembic
  migrations are the contract.

## Alternatives considered

- **Celery + Redis** — battle-tested, but adds two services
  (Redis + workers), a second failure domain, and a separate
  observability surface. Premature for solo-dev scale.
- **RQ (Redis Queue)** — lighter than Celery, same trade-off on the
  Redis dependency.
- **AWS SQS** — vendor lock-in; ties local dev to LocalStack or a
  cloud round-trip.
- **ARQ (the Python library)** — name collision with the project's
  internal **ARQ extraction pipeline** term (the
  `use_arq_pipeline` GrowthBook flag refers to the *pipeline*, not
  the Python library). Future contributors should know this overlap
  is historical naming, not an architectural reference.
- **Dramatiq** — similar profile to Celery, still a separate broker.
- **NATS / JetStream** — capable but heavyweight to operate for the
  current scale.

## References

- Source: Commit `08129f9` — "postgres-backed job queue with
  idempotency".
- Source: `fastapi_backend/app/services/job_queue.py` —
  `claim_next_pending` (`FOR UPDATE SKIP LOCKED`), idempotency lookup,
  lease handling.
- Source: `fastapi_backend/app/worker.py` — worker poll loop.
- Source: `docker-compose.yml` lines 540–596 — `worker` service
  (shares the backend image, runs `python -m app.worker`, scales
  horizontally).
- Related: [open-questions.md](../open-questions.md#7-postgres-job-queue-vs-alternatives)
