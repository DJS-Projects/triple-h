# ADR 0006: OpenTelemetry for HTTP / DB / pipeline tracing

- **Status:** Inferred — pending confirmation (usage pattern recorded, vendor choice isn't)
- **Date:** 2026-04 (best estimate, branch `feat/arq-extraction`)
- **Decider:** DarrenSJZ (sole maintainer)

## Context

The extraction service spans many moving parts inside a single request: a
FastAPI handler accepts the upload, asyncpg writes a job row, httpx calls
out to the LiteLLM proxy (which itself fans out to Groq/NIM/Google/Ollama),
and the pipeline runs a sequence of named stages (`classify`,
`chandra_extract`, `pdf2image_render`, `docling_dump`, `llm_agent_run`).
Without request-scoped traces the only way to attribute latency or chase a
hang is to read stdout logs interleaved across containers — slow and
imprecise.

A vendor APM (DataDog, New Relic, Honeycomb) would solve this off the
shelf, but the project is solo-dev and early enough that locking into a
SaaS billing relationship for telemetry is premature. The local docker
stack needs to "just work" on a fresh clone without any external account.

## Decision

Adopt the OpenTelemetry SDK with auto-instrumentation for FastAPI, httpx,
and asyncpg, plus manual spans wrapping each pipeline stage in
`app/services/extraction/pipeline.py` (`classify`, `chandra_extract`,
`pdf2image_render`, `docling_dump`, `llm_agent_run`, etc.).

The OTLP exporter is wired in but the endpoint is environment-driven. When
`OTEL_EXPORTER_OTLP_ENDPOINT` is empty (the default), spans render to
backend stdout — `docker compose logs backend` after a request shows the
full trace tree with per-span durations. Setting the env to
`http://jaeger:4317` (or any OTLP-compatible collector — SigNoz, Grafana
Tempo) flips ingestion to that collector without code changes.

## Consequences

- Vendor-neutral instrumentation. Swapping the collector is a one-env-var
  change; no app code touches a vendor SDK.
- Local dev sees a usable trace tree without running a collector — the
  stdout fallback is the on-ramp.
- `TimingMiddleware` is kept alongside OTel. It emits a `Server-Timing`
  HTTP header plus a one-line per-request log, which is faster to read in
  browser DevTools than firing up a collector UI for routine perf checks.
- Auto-instrumentation captures DB query timings and outbound httpx calls
  "for free" — no manual span code for those layers.
- Span overhead is non-zero. If a hot path turns up in profiling, the
  console exporter is the first thing to disable.

## Alternatives considered

- **DataDog APM** — solid product, but SaaS billing and vendor lock-in are
  premature for a solo-dev early-stage service.
- **New Relic** — same trade-off as DataDog.
- **Honeycomb** — excellent for high-cardinality tracing, but paid and a
  commitment to make this early.
- **Grafana stack only (Tempo / Loki) without OTel wire format** — works,
  but locks instrumentation to one collector family. OTel's whole value is
  collector portability.
- **Pure logging (structured JSON logs only)** — no span tree, no
  parent/child causality, impossible to attribute latency across an async
  pipeline.

## References

- Source: `CLAUDE.md` lines 62–70, 113–115 (observability stack + per-stage
  timing notes).
- Source: `fastapi_backend/app/observability.py` (OTel init + GrowthBook
  wiring).
- Source: `fastapi_backend/app/services/extraction/pipeline.py` (manual
  spans).
- Source: `fastapi_backend/pyproject.toml` lines 466–474 (OTel SDK + OTLP
  exporter + FastAPI auto-instrumentation deps).
- Related: [open-questions.md](../open-questions.md#5-opentelemetry-vs-alternatives)
