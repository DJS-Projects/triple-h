# Open questions — undocumented decisions

Six architectural decisions live in the code with no recorded rationale anywhere — not in `CLAUDE.md`, not in commit messages, not in code comments. This file lists each, points to where the decision shows up, offers a best-inference reconstruction from the code/commit history, and notes what would convert it from "inferred" to "accepted."

Each section has a stable anchor. ADRs marked `Status: Inferred — pending confirmation` cross-link here. If you confirm an inference, copy the rationale into the corresponding ADR's `## Context` and `## Alternatives considered` and flip the ADR status to `Accepted`.

---

## 1. Three-stage extraction

**Question:** Why Chandra (OCR) + DoclingDocument (IR) + vision LLM (semantics), instead of Chandra-only or Docling-full?

**Where it shows up in code:**
- `fastapi_backend/pyproject.toml` lines 15–24 — partial rationale comment ("We do NOT use the full `docling` pipeline — Chandra supplies all OCR + structure, and our adapter maps it to DoclingDocument")
- `fastapi_backend/app/services/extraction/pipeline.py` — stage orchestration
- `fastapi_backend/app/services/docling_adapter.py` — Chandra → DoclingDocument map
- `fastapi_backend/app/services/chandra_ocr.py` — Datalab Chandra integration

**My best inference from code/commits:** Chandra handles OCR + structure detection end-to-end via Datalab SDK, including auth, polling, and retries — so the repo doesn't need to run its own OCR engine, layout model, or TableFormer locally. DoclingDocument is kept as a canonical IR with provenance/bboxes so downstream code (review UI, ARQ anchors, refinement layer) doesn't depend on Chandra's response shape — meaning Chandra could be swapped for another OCR provider without breaking consumers. The vision LLM stage adds semantic field extraction that pure OCR cannot — typed values, cross-page reasoning, doc-type-aware schemas. The partial comment in `pyproject.toml` confirms the "schema only, not pipeline" intent for Docling but doesn't explain the LLM-stage decision.

**What would confirm/deny:** A note in `pipeline.py`'s module docstring or in a new ADR 0001 explaining the three-stage rationale and citing alternatives that were considered (Chandra-only with regex, LLM-only on PDF images, Docling-full).

[ADR: 0001-three-stage-extraction.md](decisions/0001-three-stage-extraction.md)

---

## 2. ARQ pipeline migration

**Question:** Why migrate from single-pass extraction to a two-stage path (deterministic anchors + [ARQ-prompted](https://arxiv.org/abs/2503.03669) LLM), when single-pass is "working"?

> **ARQ = Attentive Reasoning Queries** (Karov, Zohar, Marcovitz, 2025 — [arXiv 2503.03669](https://arxiv.org/abs/2503.03669)). A Stage 2 prompting technique where the model fills an ordered sequence of typed reasoning slots before emitting the final answer. Distinct from the Stage 1 deterministic anchor extraction (Tier-1 label proximity + Tier-2 table headers). The `use_arq_pipeline` GrowthBook flag names the whole two-stage path informally; the ARQ technique itself is only the Stage 2 prompting strategy.

**Where it shows up in code:**
- Commit `1d8a217` — "deterministic stage 1 foundation" (+1509 lines, no commit body explaining motivation)
- Commit `cd1f021` — "tier-1/tier-2 anchors + per-doc-type ARQ schemas"
- Commit `9f6e3d3` — "T9 — wire ARQ two-stage path behind GrowthBook flag"
- `fastapi_backend/app/services/extraction/pipeline.py` — flag gate
- `fastapi_backend/app/services/extraction/arq.py` — per-doc-type ARQ schemas (DeliveryOrderARQ, WeighingBillARQ, InvoiceARQ, PetrolBillARQ)
- `fastapi_backend/app/services/extraction/anchors.py` — Tier-1 (label proximity) + Tier-2 (table headers)

**My best inference from code/commits:** Single-pass LLM extraction is non-deterministic and gives no field provenance — a reviewer sees "value: X" with no way to verify which line in the source produced X. The two-stage path fixes both gaps. **Stage 1** is deterministic anchor extraction: Tier-1 walks the document for known field labels and grabs the nearest value; Tier-2 reads table headers and aligns columns to fields. Each candidate is a `FieldProvenance` record (value, bbox, page, source). **Stage 2** is ARQ-prompted LLM extraction — per-doc-type wrapper schemas (`DeliveryOrderARQ` etc.) with ordered reasoning slots (`visual_audit`, `field_grounding`, `id_code_audit`) that the model fills before emitting the final extraction. The Stage 1 anchors are inlined into the ARQ prompt as evidence so the model confirms verbatim instead of confabulating. The ARQ technique itself (from the paper) is what makes Stage 2 reasoning inspectable; the anchors are what make it grounded. Gating behind `use_arq_pipeline` enables A/B against legacy. Default-off keeps the safer path live during validation.

**What would confirm/deny:** An ADR 0003 or a PRD/design note in `docs/decisions/` explaining the audit-trail / field-provenance motivation, the per-doc-type schema design rationale, and the planned A/B success criteria.

[ADR: 0003-arq-pipeline-migration.md](decisions/0003-arq-pipeline-migration.md)

---

## 3. GrowthBook vs alternatives

**Question:** Why GrowthBook for feature flags, vs LaunchDarkly / Statsig / Unleash / Flagsmith?

**Where it shows up in code:**
- `docker-compose.yml` — `growthbook` + `gb-mongo` services
- `fastapi_backend/app/observability.py` — `is_feature_on()` wrapper
- `CLAUDE.md` lines 72–87 — usage pattern (not vendor choice rationale)

**My best inference from code/commits:** GrowthBook is self-hostable, OSS, has no per-seat pricing, and has decent JS + Python SDKs. The deployment shape (two containers: web UI + Mongo) fits an already-self-hosted observability stack (Langfuse, OTel-stdout). LaunchDarkly would be the SaaS default but is expensive per-seat. Statsig is experimentation-first (overkill for boolean gates). Unleash and Flagsmith are also self-hostable but Unleash is Node-heavy and Flagsmith is Django-centric — GrowthBook's Postgres+JS+Python shape sits cleanly alongside the existing FastAPI+NextJS stack. The safe-default fallback pattern (`is_feature_on(flag, default=False)`) means a broken GrowthBook never degrades availability.

**What would confirm/deny:** An ADR 0004 explaining the vendor-comparison and the self-host preference (cost, no SaaS dep, observability stack alignment).

[ADR: 0004-growthbook-flags.md](decisions/0004-growthbook-flags.md)

---

## 4. Langfuse vs alternatives

**Question:** Why Langfuse for LLM observability, vs Helicone / Phoenix / LangSmith / LiteLLM-native logs?

**Where it shows up in code:**
- `docker-compose.yml` — `langfuse` + `langfuse-db` services
- `litellm/config.yaml` — `success_callback` references Langfuse
- `CLAUDE.md` lines 51–61 — bootstrap (not vendor rationale)

**My best inference from code/commits:** Langfuse is self-hostable, free, and integrates with LiteLLM via a single-line `success_callback` — meaning every LLM call is captured automatically with no SDK wrapping at call sites. Helicone is similar in feature scope but is proxy-based, which conflicts with the existing LiteLLM proxy (would mean stacking proxies). Phoenix (Arize) is heavier and OTel-shaped — would duplicate the OTel work. LangSmith requires LangChain, which was deliberately ripped out in commit `629d7ca`. LiteLLM-native logs exist but lack the trace/inspection UI Langfuse provides. The callback integration also keeps app code clean — no `langfuse.log_*()` calls scattered through pipeline code.

**What would confirm/deny:** An ADR 0005 noting the LiteLLM-callback fit and the explicit LangChain-incompatibility constraint.

[ADR: 0005-langfuse-observability.md](decisions/0005-langfuse-observability.md)

---

## 5. OpenTelemetry vs alternatives

**Question:** Why OpenTelemetry (with stdout fallback), vs DataDog / New Relic / Honeycomb / Grafana-only stack?

**Where it shows up in code:**
- `fastapi_backend/app/observability.py` — OTel init
- `fastapi_backend/app/services/extraction/pipeline.py` — manual spans per stage
- `CLAUDE.md` lines 62–70 — usage pattern (not vendor rationale)

**My best inference from code/commits:** OpenTelemetry is vendor-neutral — instrument once, swap collectors (Jaeger / SigNoz / Tempo) later without touching app code. The repo currently ships with no collector configured (`OTEL_EXPORTER_OTLP_ENDPOINT` empty → spans go to stdout, visible via `docker compose logs backend`). This is a deliberate "instrument now, decide where to ship later" posture. DataDog and New Relic are expensive SaaS APMs with vendor lock-in; Honeycomb is good but paid; Grafana stack alone (Tempo) without OTel wire format would lock to one collector. The `TimingMiddleware` alongside (emits `Server-Timing` HTTP header) gives a fast browser-DevTools-friendly view without needing a collector for casual inspection.

**What would confirm/deny:** An ADR 0006 explicitly framing the vendor-neutrality posture and citing the "stdout for now, collector later" intent.

[ADR: 0006-opentelemetry-tracing.md](decisions/0006-opentelemetry-tracing.md)

---

## 6. DSPy for refinement layer

**Question:** Why DSPy for the refinement layer, vs hand-rolled prompts?

**Where it shows up in code:**
- `fastapi_backend/app/refinement/` — DSPy-based field refinement
- `fastapi_backend/pyproject.toml` — `dspy-ai` dependency
- Earlier commits: `b171125` (backend DSPy + Gemma VLM refinement layer), `5de8029` (frontend VLM Refinement panel)
- Later commit: `4af3a70` (refactor(frontend): drop VLM bbox overlay from canvas) — only the FE UX was dropped; backend DSPy infrastructure remains

**My best inference from code/commits:** DSPy provides typed signatures (input/output contracts on every "module"), automatic prompt optimization (GEPA-path support — compile a prompt against gold data to find a better version), and traceable I/O (every module call is inspectable). Hand-rolled prompts can't be optimized programmatically and lack the typed contract. For a refinement layer where the same prompt structure runs across many inputs and gold-truth comparisons are available, DSPy's compile-time prompt search is load-bearing. The fact that backend DSPy survived the `4af3a70` frontend cull strongly suggests DSPy is still being used — but the VLM-bbox UX that depended on it was decided to be not worth the complexity. Inferred: DSPy is being kept as the substrate for future field-level refinement (correctors / human-in-the-loop) without committing to a specific UX yet.

**What would confirm/deny:** An ADR (would need a new number — 0011 or higher, since the existing series stops at 0010) covering the DSPy-for-refinement decision and explicitly stating that VLM-bbox UX was a separate dropped experiment, not a DSPy retreat.

---

## 7. Postgres job queue vs alternatives

**Question:** Why a custom Postgres-backed job queue (`FOR UPDATE SKIP LOCKED` + lease/sweeper), vs Celery+Redis / RQ / SQS / Dramatiq / NATS?

**Where it shows up in code:**
- Commit `08129f9` — "postgres-backed job queue with idempotency" (+717 lines, no commit body explaining vendor decision)
- `fastapi_backend/app/services/job_queue.py` — `claim_next_pending()`, `mark_succeeded()`, `mark_failed()`, lease/sweeper
- `fastapi_backend/app/worker.py` — polling loop, idempotency-key handling
- `fastapi_backend/app/routes/jobs.py` — `/extract/jobs` 202 response + SSE stream
- `docker-compose.yml` — no Redis service (would be required for Celery/RQ); only Postgres

**My best inference from code/commits:** Extraction jobs take 30–200s — too slow for a request handler. The queue must support idempotency (FE retries shouldn't duplicate work), atomic claim across N workers (no double-processing), retry with backoff, and a status surface for FE polling/streaming. A Postgres-backed queue meets all of these with **zero new infrastructure** — the app DB already exists. Job state is transactional with extraction data (no two-system consistency problem). `FOR UPDATE SKIP LOCKED` is a well-known idiom that scales to dozens of concurrent workers on a single Postgres. The lease field (`lease_expires_at`) plus a sweeper handles crashed workers. Celery+Redis would add 2 services and a separate failure mode. SQS would add vendor lock. RQ/Dramatiq are simpler but still add Redis. **Trade-off:** scales only to one Postgres's connection budget — at thousands of workers, a dedicated queue would win. At current scale (one to a few workers), Postgres is the right call. **Important naming note:** The `use_arq_pipeline` GrowthBook flag refers to the two-stage extraction path that uses **ARQ — Attentive Reasoning Queries** ([arXiv 2503.03669](https://arxiv.org/abs/2503.03669)) — at Stage 2, NOT the Python ARQ library (job queue framework). Triple name collision: the paper, the flag, and a Python library all called "ARQ" but unrelated.

**What would confirm/deny:** An ADR 0009 reference to the scale ceiling (~connection-budget bound) and the explicit anti-coupling argument (no Redis → simpler stack → easier observability).

[ADR: 0009-postgres-job-queue.md](decisions/0009-postgres-job-queue.md)

---

## What to do with this file

- Each ADR with `Status: Inferred — pending confirmation` cross-links to one of the sections above.
- In a future session: review each inference. For ones that are correct, lift the rationale into the matching ADR's `## Context` and `## Alternatives considered`, and flip Status to `Accepted`. For ones that need correction, edit the inference here first, then update the ADR.
- New gaps discovered during further work should be appended here as section 7, 8, ... with the same shape.
