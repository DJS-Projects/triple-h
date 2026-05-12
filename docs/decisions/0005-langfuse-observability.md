# ADR 0005: Langfuse for LLM observability (via LiteLLM callback)

- **Status:** Inferred — pending confirmation
- **Date:** 2026-04-20
- **Decider:** DarrenSJZ (sole maintainer)

## Context

Multi-provider LLM workloads need per-call telemetry that survives provider swaps:

- Prompt + completion (verbatim, for replay and prompt-iteration).
- Token usage and cost (per-provider, normalized).
- Latency (end-to-end and provider-side where reported).
- Per-trace drill-down (for debugging a single bad extraction).

The observability stack must be:

- **Independent of application code.** Swapping the LLM provider shouldn't break observability, and adding observability shouldn't sprawl into every call site.
- **Self-hostable.** Solo-dev, no SaaS budget, and prompts/completions are customer data.
- **Compatible with the LiteLLM proxy (ADR 0002),** since every LLM call already goes through there.

## Decision

- Self-host **Langfuse** via Docker Compose:
  - `langfuse` (image `langfuse/langfuse:2`) — web UI on host `:3001`, internal `:3000`.
  - `langfuse-db` (Postgres 17) — dedicated DB for Langfuse, isolated from the application DB.
- Wire via the LiteLLM `success_callback` (and `failure_callback`) in `litellm/config.yaml`:
  ```yaml
  litellm_settings:
    success_callback: ["langfuse"]
    failure_callback: ["langfuse"]
  ```
- Bootstrap is manual: sign up at `http://localhost:3001`, create org + project, copy public + secret keys, add via `mise env:addkey`. Documented in `CLAUDE.md` lines 58–67.
- Run **Langfuse v2** (single web container + Postgres), not v3 (adds ClickHouse + Redis + worker). v2 is sufficient for solo-dev / single-tenant ingest volume.

## Consequences

- LLM telemetry is fire-and-forget from the application's perspective. The backend never imports the Langfuse SDK for LLM calls — LiteLLM handles it.
- Empty Langfuse keys are a soft-fail: LiteLLM logs a warning and continues. Fresh clones boot without manual setup.
- Adds two containers (`langfuse`, `langfuse-db`) and a Postgres volume (`langfuse_pg`) to the stack.
- When ingest volume outgrows v2, the upgrade path is to v3 (ClickHouse + Redis + worker). Not needed at current scale.
- LiteLLM env (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`) and the backend env both read the same Langfuse settings — any future backend-side direct Langfuse SDK calls (non-LLM events) would use the same project.

## Alternatives considered

- **Helicone** — proxy-based observability. Conflicts with our existing LiteLLM proxy (would need to chain proxies or swap LiteLLM for Helicone's). Not worth the upheaval.
- **Phoenix / Arize** — heavier OTel-shaped tracing. Duplicates the OTel pipeline we already run for HTTP/DB/stage spans (see `app/observability.py`) without adding LLM-specific UX advantages over Langfuse.
- **LangSmith** — tightly coupled to LangChain, which we removed in commit `629d7ca`. Not applicable.
- **LiteLLM-native log files only** — works but offers no UI, no per-trace inspection, no cost rollups across providers, and no shareable links for debugging a specific bad extraction.
- **Self-rolled SQL logging** — months of work to reproduce trace browsing, prompt comparison, cost rollups. Not justified.

## References

- Source: `CLAUDE.md` "Langfuse (LLM observability)" section (bootstrap steps, URL, callback wiring summary).
- Source: `litellm/config.yaml` `litellm_settings.success_callback` / `failure_callback` lines.
- Source: `docker-compose.yml` `langfuse` + `langfuse-db` services (with v2-vs-v3 rationale comment inline).
- Removal of LangChain (kills the LangSmith option): commit `629d7ca`.
- Related: [open-questions.md](../open-questions.md#4-langfuse-vs-alternatives)
