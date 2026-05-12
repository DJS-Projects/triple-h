# Observability

Three subsystems handle different cross-sections of operational
visibility: OpenTelemetry for HTTP/DB/pipeline-stage tracing, Langfuse
for LLM-call telemetry (prompt, completion, tokens, cost, latency),
and GrowthBook for feature flags with safe-default fallback. All three
boot empty-keyed so `mise docker:up` works on a fresh clone — flag
checks and callbacks degrade gracefully when their backends are
unreachable.

## TL;DR

`app/observability.py` boots both OTel and GrowthBook with idempotency
guards (uvicorn `--reload` re-imports `main.py`). OTel auto-instruments
FastAPI + httpx + asyncpg; manual spans wrap every pipeline stage.
Langfuse is wired only at the LiteLLM proxy via the `success_callback`
declared in `litellm/config.yaml:125`. GrowthBook is read through
`is_feature_on(flag_key, default=...)` which always returns `default`
when the SDK isn't configured or the call raises. The bootstrap steps
(create projects, copy keys, run `mise env:addkey`) are documented in
[CLAUDE.md:51-87](../../CLAUDE.md) — do not re-paste them here.

## Triad diagram

```mermaid
flowchart LR
  subgraph be[backend / worker]
    fa[FastAPI app]
    px[httpx clients]
    pg_client[asyncpg pool]
    pipe[extract_structured<br/>manual spans]
    flag[is_feature_on<br/>safe default]
  end

  ll[litellm proxy]
  lf[Langfuse UI<br/>localhost:3001]
  gb[GrowthBook<br/>UI :3031<br/>SDK :3101]
  otel[(OTel collector<br/>OR stdout)]

  fa -. FastAPIInstrumentor .-> otel
  px -. HTTPXClientInstrumentor .-> otel
  pg_client -. AsyncPGInstrumentor .-> otel
  pipe -. tracer.start_as_current_span .-> otel
  pipe -- LLM call --> ll
  ll -- success_callback<br/>failure_callback --> lf
  flag -- HTTP SDK fetch --> gb
  pipe -- read flag --> flag
```

When `OTEL_EXPORTER_OTLP_ENDPOINT` is empty (default), the collector
node is replaced by `ConsoleSpanExporter` — spans render to backend
stdout, visible via `docker compose logs backend`.

## OpenTelemetry

### Bootstrap

`init_otel(app)` in `fastapi_backend/app/observability.py:76-115`:

- Idempotent (module-level `_otel_initialized` flag) because uvicorn
  `--reload` re-imports `main.py` on file changes.
- Skipped under pytest — `ConsoleSpanExporter` writes to stdout which
  pytest's capture machinery rotates between tests, causing
  `BatchSpanProcessor` to crash with "I/O operation on closed file"
  (`observability.py:81-92`).
- Builds an `OTLPSpanExporter` when `OTEL_EXPORTER_OTLP_ENDPOINT` is
  set, otherwise `ConsoleSpanExporter` (`observability.py:66-73`).
- Resource attribute `service.name` defaults to `triple-h-backend`
  (backend container) or `triple-h-worker` (worker container) per
  docker-compose env (`docker-compose.yml:26,90`).

Auto-instrumentation hooks the three boundary surfaces that matter
(`observability.py:106-112`):

| Instrumentor | Coverage |
|--------------|----------|
| `FastAPIInstrumentor` | Every HTTP request in — route, status, latency |
| `HTTPXClientInstrumentor` | Every HTTP request out — Chandra REST, LiteLLM proxy calls |
| `AsyncPGInstrumentor` | Every Postgres query — claim/insert/update spans |

### Manual pipeline spans

The extraction pipeline at
`fastapi_backend/app/services/extraction/pipeline.py:550-792` opens an
outer `extract_structured` span on every request and hangs the
following children off it:

- `classify` — vision classifier call
- `chandra_extract` — Datalab Chandra OCR
- `pdf2image_render` — page rasterisation (parallel sibling to
  `chandra_extract`)
- `docling_dump` — DoclingDocument serialisation
- ARQ branch only: `preprocess_text`, `extract_anchors`,
  `llm_agent_run_arq`, `postprocess`, `validate_and_correct`
- Single-pass branch: `llm_agent_run`

Attributes set on the outer span: `doc_type`, `model`, `dpi`,
`pipeline_variant`, `page_count`. Stage spans add stage-specific
attributes (anchor counts, image counts, markdown char counts) for
flame-graph triage.

### Reading traces

- **With an OTLP endpoint configured** (e.g.
  `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317`): open the
  collector's UI (Jaeger, SigNoz, Tempo) and filter by
  `service.name=triple-h-backend`. The `extract_structured` root
  span is the entry point.
- **Without an endpoint** (default fresh-clone state): grep backend
  logs:

```bash
docker compose logs backend | grep -E "(extract_structured|chandra_extract|llm_agent_run|extract_anchors)"
```

Each span renders as a multi-line JSON blob including the
`duration_ms`, attributes, and parent span id.

`TimingMiddleware` (separately wired) also emits a `Server-Timing`
header + a one-line per-request log; the browser DevTools Network tab
shows the header. OTel is the deeper-drill counterpart.

## Langfuse

### Wiring

LiteLLM-only. `litellm/config.yaml:116-126`:

```yaml
litellm_settings:
  success_callback: ["langfuse"]
  failure_callback: ["langfuse"]
```

LiteLLM reads `LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`,
`LANGFUSE_SECRET_KEY` from its container env
(`docker-compose.yml:135-140`). On a fresh clone these are empty;
LiteLLM logs a warning and continues without the callback. After the
bootstrap (`CLAUDE.md:54-65`), every LLM call captures:

- Prompt (full text + image attachments)
- Completion (raw model output)
- Token usage (input/output counts)
- Cost (computed by LiteLLM from the model price table)
- Latency (request to first token, first token to last token)
- Model + provider routing decision (incl. fallback chain hits)

### Reading

UI at `http://localhost:3001` after the bootstrap. Tracing tab groups
calls by session; each call links back to the LiteLLM virtual model
name from `litellm/config.yaml`.

Backend doesn't currently call the Langfuse SDK directly — the
`LANGFUSE_*` env vars on the backend service
(`docker-compose.yml:36-38`) are forwarded so any future direct usage
reads from the same `Settings` source.

## GrowthBook

### Wiring

`init_growthbook()` in `observability.py:121-154`. Lazy initialisation:
returns a client only when both `GROWTHBOOK_API_HOST` and
`GROWTHBOOK_CLIENT_KEY` are set. On failure (network error, SDK
exception) the client stays `None` and a warning is logged — the app
never crashes on observability outage.

The internal docker-network SDK port is `growthbook:3100`; host port
mappings (3031 UI, 3101 SDK) are offset to avoid colliding with a
separate GrowthBook instance some dev machines run on 3030/3100
(`docker-compose.yml:241-261`).

### Reading flags safely

Every flag check goes through `is_feature_on(flag_key, default=...)`
at `observability.py:162-187`. Returns `default` when:

- GrowthBook isn't configured (no host or no key)
- The flag doesn't exist in the GrowthBook project
- The SDK call raises (network, etc.)

Always pick `default` so the safer code path runs when GrowthBook is
down. For `use_arq_pipeline` the default is `False` — flag-server
outage routes traffic through the proven single-pass pipeline.

### Active flags

| Flag key | Default | Effect when ON | Read site |
|----------|---------|----------------|-----------|
| `use_arq_pipeline` | `False` | Run the ARQ two-stage pipeline (preprocess → anchors → ARQ LLM → postprocess → correct → envelope) instead of single-pass | `pipeline.py:611` |

## Bootstrap

Do not re-implement here. Follow [CLAUDE.md:51-87](../../CLAUDE.md):

- Langfuse setup: sign up at `:3001`, create project, copy API keys,
  `mise env:addkey LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY`,
  restart with `mise docker:up`.
- GrowthBook setup: open `:3031`, create project, SDK Connections →
  copy key, `mise env:addkey GROWTHBOOK_CLIENT_KEY`, create the
  `use_arq_pipeline` boolean feature, restart with `mise docker:up`.

## Cross-links

- Pipeline span names + branch points: [extraction-pipeline.md](extraction-pipeline.md)
- Where the queue surfaces traces (claim SQL, worker stage transitions):
  [async-job-queue.md](async-job-queue.md)
- Container ports + env var sources: [overview.md](overview.md)
- Open follow-ups (OTel collector choice, flag rollout strategy):
  [open-questions.md](../open-questions.md)
