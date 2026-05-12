# Architecture Decision Records

ADRs capture decisions that shaped this codebase. Each has a **Status**:

- **Accepted** — rationale exists in repo (`CLAUDE.md`, inline comments, commit body).
- **Inferred — pending confirmation** — rationale was reverse-engineered from code, commit messages, or dependency choices. Open question filed in [open-questions.md](../open-questions.md).
- **Superseded** — replaced by a later ADR. The original stays in place; the new ADR points back to it.

## Conventions

- ADRs are numbered sequentially. Numbers are **never** reused or renumbered.
- A superseded ADR keeps its file and number. The replacement ADR references it under `## Context` and links back.
- Filenames: `NNNN-kebab-title.md` (zero-padded to four digits).
- One decision per ADR. If a decision is large, split it.

## Index

| #    | Title                                                                 | Status                            | Date       |
|------|-----------------------------------------------------------------------|-----------------------------------|------------|
| 0001 | [Three-stage extraction (Chandra + DoclingDocument IR + vision LLM)](0001-three-stage-extraction.md) | Inferred — pending confirmation   | 2026-03-25 |
| 0002 | [All LLM traffic via LiteLLM proxy](0002-litellm-proxy.md)            | Accepted                          | 2026-04-10 |
| 0003 | [ARQ two-stage extraction (anchored, deterministic Stage 1)](0003-arq-pipeline-migration.md) | Inferred — pending confirmation   | 2026-05-01 |
| 0004 | [GrowthBook for feature flags (self-hosted)](0004-growthbook-flags.md) | Inferred — pending confirmation   | 2026-04-28 |
| 0005 | [Langfuse for LLM observability (via LiteLLM callback)](0005-langfuse-observability.md) | Inferred — pending confirmation   | 2026-04-20 |
| 0006 | [OpenTelemetry for HTTP / DB / pipeline tracing](0006-opentelemetry-tracing.md) | Inferred — pending confirmation   | 2026-04    |
| 0007 | [Encrypted `.env` files via dotenvx](0007-dotenvx-encrypted-env.md) | Accepted                          | 2026-03    |
| 0008 | [mise as the canonical task runner](0008-mise-task-runner.md) | Accepted                          | 2026-03    |
| 0009 | [Postgres-backed async job queue (no Redis/Celery/SQS)](0009-postgres-job-queue.md) | Inferred — pending confirmation   | 2026-04    |
| 0010 | [Open-weights-only LLM policy](0010-open-weights-models.md) | Accepted                          | 2026-03    |

## ADR template

Copy this block into a new file `NNNN-title.md` when recording a new decision.

```markdown
# ADR NNNN: <title>

- **Status:** Accepted | Inferred — pending confirmation | Superseded
- **Date:** YYYY-MM-DD (of the commit/decision, best estimate)
- **Decider:** DarrenSJZ (sole maintainer)

## Context
<why this decision was needed — 1-3 paragraphs>

## Decision
<what was chosen, concretely — bullet list ok>

## Consequences
<what this implies for the codebase, ops, future changes — bullet list>

## Alternatives considered
<other options with one-line rejection rationale per alt — even if speculative, mark them as inferred>

## References
- Source: <file:line or commit hash>
- Related: [open-questions.md](../open-questions.md) (when Status is Inferred)
```

## Notes for future authors

- Prefer concrete file paths, line ranges, and commit SHAs over vague references.
- When an ADR's status is `Inferred`, every guess should also be filed in `open-questions.md` so the author of record can confirm or correct it.
- Keep each ADR under 250 lines. If a decision needs more, it is probably two decisions.
