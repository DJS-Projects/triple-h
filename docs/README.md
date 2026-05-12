# triple-h documentation vault

PDF → structured data extraction service. This vault answers four questions:

1. **What was built** — current static shape → [`architecture/`](architecture/)
2. **How it was built** — chronological journey → [`history/`](history/)
3. **Decisions that lived and decisions that died** — surviving choices + rejected paths → [`decisions/`](decisions/) + [`history/abandoned-paths.md`](history/abandoned-paths.md)
4. **Where we are now** — see "Current state" section below

> For the active project guide (mise tasks, observability bootstrap, git rules), see [`../CLAUDE.md`](../CLAUDE.md). The vault is human-and-future-agent reading; CLAUDE.md is the live operator manual.

---

## Current state (snapshot)

- **Branch:** `feat/arq-extraction` (49 commits ahead of `main`).
- **Pipeline:** ARQ two-stage extraction available behind GrowthBook flag `use_arq_pipeline` (default off → legacy single-pass remains the safe path).
- **Observability triad:** OpenTelemetry (stdout fallback) + Langfuse (LiteLLM `success_callback`) + GrowthBook (safe-default flag reads) — all self-hosted via docker-compose.
- **Async pipeline:** Postgres-backed job queue (`FOR UPDATE SKIP LOCKED`), SSE stream FE↔BE for live status.
- **LLM policy:** Open-weights only. Ollama Gemma 4 31B primary; Google Gemma fallback; Groq Llama 4 Scout/Maverick, NIM Llama 90B vision, Doubleword Qwen 3.5 in rotation.
- **No releases tagged.** Every commit is treated as live; no semver, no changelog.

---

## Map of the vault

### architecture/ — what was built
- [`overview.md`](architecture/overview.md) — system topology, container diagram, per-service purpose.
- [`extraction-pipeline.md`](architecture/extraction-pipeline.md) — Chandra → Docling IR → vision LLM, single-pass vs ARQ branching.
- [`async-job-queue.md`](architecture/async-job-queue.md) — Postgres queue, worker claim mechanics, SSE proxy.
- [`data-model.md`](architecture/data-model.md) — DB schema + ER diagram, Alembic migration list.
- [`observability.md`](architecture/observability.md) — OTel + Langfuse + GrowthBook wiring.

### decisions/ — decisions that lived
ADR-style records. Status field indicates whether rationale is Accepted (recorded) or Inferred (reverse-engineered — see [open-questions.md](open-questions.md)).

- [`README.md`](decisions/README.md) — ADR index with status + date.
- [`0001-three-stage-extraction.md`](decisions/0001-three-stage-extraction.md) — Chandra + DoclingDocument IR + vision LLM.
- [`0002-litellm-proxy.md`](decisions/0002-litellm-proxy.md) — All LLM calls via litellm:4000.
- [`0003-arq-pipeline-migration.md`](decisions/0003-arq-pipeline-migration.md) — Deterministic anchor extraction + LLM augmentation.
- [`0004-growthbook-flags.md`](decisions/0004-growthbook-flags.md) — Self-hosted feature flags with safe-default fallback.
- [`0005-langfuse-observability.md`](decisions/0005-langfuse-observability.md) — LLM telemetry via LiteLLM callback.
- [`0006-opentelemetry-tracing.md`](decisions/0006-opentelemetry-tracing.md) — Vendor-neutral tracing, stdout fallback.
- [`0007-dotenvx-encrypted-env.md`](decisions/0007-dotenvx-encrypted-env.md) — Encrypted env via dotenvx + .env.keys.
- [`0008-mise-task-runner.md`](decisions/0008-mise-task-runner.md) — mise wraps dotenvx, pins cwd, chains tasks.
- [`0009-postgres-job-queue.md`](decisions/0009-postgres-job-queue.md) — `FOR UPDATE SKIP LOCKED` queue in app DB.
- [`0010-open-weights-models.md`](decisions/0010-open-weights-models.md) — No closed-weight models.

### history/ — how it was built
- [`origin.md`](history/origin.md) — fork-cleanup story; pre-`5e30153` monolith; what survived.
- [`timeline.md`](history/timeline.md) — full commit-by-commit narrative across all 118 commits, grouped in 6 phases.
- [`abandoned-paths.md`](history/abandoned-paths.md) — decisions that died (auth, chandra probes, langchain, items CRUD, VLM bbox overlay) with commit refs.

### open questions
- [`open-questions.md`](open-questions.md) — 7 architectural decisions with no recorded rationale + best-inference reconstructions. Each cross-links to its ADR. Resolve by lifting confirmed inferences into the ADR's `## Context`.

---

## Reading paths

- **New to the codebase?** Start with [`architecture/overview.md`](architecture/overview.md), then [`extraction-pipeline.md`](architecture/extraction-pipeline.md), then read [`history/origin.md`](history/origin.md) for context on what this repo isn't.
- **Why does X exist?** Search [`decisions/`](decisions/). If marked Inferred, cross-check the matching section in [`open-questions.md`](open-questions.md).
- **What got deleted and why?** [`history/abandoned-paths.md`](history/abandoned-paths.md).
- **What changed between two dates?** [`history/timeline.md`](history/timeline.md), grouped by phase.

---

## Conventions

- **ADR status values:** `Accepted` (rationale recorded) | `Inferred — pending confirmation` (reverse-engineered) | `Superseded` (overridden by a later ADR).
- **Commit refs:** 8-character hashes. Use `git show <hash>` for full diff.
- **Cross-links:** relative paths only. No external links to docs (the vault is self-contained).
- **Diagrams:** inline Mermaid (renders natively on GitHub).
