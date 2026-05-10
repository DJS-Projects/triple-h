# triple-h — project guide

## Tool execution: prefer `mise` tasks

This project uses [mise](https://mise.jdx.dev/) as the task runner. **Default to `mise <task>` for any operation that has a defined task.** Run `mise tasks` (or read `mise.toml`) before reaching for raw `docker compose`, `uv`, `bun`, `alembic`, or `pytest`.

Why: tasks bundle the dotenvx wrapper (so encrypted env vars decrypt correctly), pin the working directory, and chain dependencies (e.g. `setup` calls `setup:be` + `setup:fe`).

### Task cheatsheet

| Action | Use this |
|--------|----------|
| First-time setup | `mise setup` |
| Start full stack | `mise docker:up` |
| Pick up backend code change | `mise docker:rebuild` |
| Hot-reload watch | `mise docker:watch` |
| Stop stack | `mise docker:down` |
| Wipe volumes | `mise docker:reset` |
| Tail logs | `mise docker:logs` |
| Backend dev (host) | `mise be:dev` |
| Frontend dev (host) | `mise fe:dev` |
| Backend tests | `mise be:test` |
| Eval suite | `mise be:test:eval` |
| Backend lint/format/typecheck | `mise be:lint`, `mise be:format`, `mise be:typecheck`, `mise be:check` |
| Frontend lint/format | `mise fe:lint`, `mise fe:format` |
| New Alembic migration | `mise be:db:revision -- "<message>"` |
| Apply migrations | `mise be:db:migrate` |
| Encrypt env files | `mise env:encrypt` |
| Decrypt env files | `mise env:decrypt` |

Only fall back to raw `docker compose ...` / `uv run ...` when:
- Debugging the task itself
- A one-off command not worth promoting to a task
- Inspecting state (`docker compose ps`, `docker compose logs`)

If you find yourself running the same raw command repeatedly, propose adding it as a `mise` task.

**Never run raw `docker compose build` / `docker compose up --build` to pick up backend code changes** — it bypasses the dotenvx wrapper, so encrypted env vars (LiteLLM keys, GrowthBook SDK key, observability keys) get passed through as their `encrypted:...` literal blobs and the backend boots without any of them. Use `mise docker:rebuild` instead — it wraps with dotenvx + adds `--force-recreate` so the new image actually runs (compose otherwise reuses the existing container when the image SHA hasn't shifted in a way it notices).

## Other rules

- Use `uv` (not `pip` / `python -m venv`) for any Python package/runtime ops in `fastapi_backend/`.
- Use `bun` (not `npm` / `pnpm` / `yarn`) for `nextjs-frontend/`.
- Encrypted env files (`fastapi_backend/.env`, `nextjs-frontend/.env`) are decrypted via dotenvx with `.env.keys`. Never commit `.env.keys`.
- All LLM calls go through the LiteLLM proxy at `http://litellm:4000` (config: `litellm/config.yaml`). Don't add direct provider clients to backend code.

## Observability stack

Three subsystems wired in. All boot empty-keyed so `mise docker:up` works on a fresh clone; do the manual bootstraps below to start receiving data.

### Langfuse (LLM observability) — `http://localhost:3001`

Captures every LLM call (prompt, completion, tokens, cost, latency) via the LiteLLM `success_callback`. **Bootstrap:**

1. `mise docker:up`
2. Open `http://localhost:3001` → Sign up → create org + project
3. Settings → API keys → Create new → copy **public** + **secret** keys
4. `mise env:addkey` — add `LANGFUSE_PUBLIC_KEY`, then again for `LANGFUSE_SECRET_KEY` (target = `be`)
5. `mise docker:up` (litellm restart picks up the keys)
6. Trigger an extraction; calls appear under Tracing in the Langfuse UI

### OpenTelemetry (HTTP / DB / pipeline-stage tracing)

Auto-instruments FastAPI, httpx, asyncpg. Manual spans on each pipeline stage (chandra, render, llm). When `OTEL_EXPORTER_OTLP_ENDPOINT` is empty, spans render to backend stdout (`docker compose logs backend`). Set the endpoint to point at a collector (Jaeger / SigNoz / Grafana Tempo) when you wire one up:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
```

`TimingMiddleware` is kept alongside OTel — it emits a `Server-Timing` HTTP header + a 1-line per-request log. Browser DevTools shows the header in the Network tab; OTel is for deeper drill-downs.

### GrowthBook (feature flags) — `http://localhost:3031`

Web UI on **3031**, SDK API on **3101** (host ports). Internal docker-network port for the backend SDK is `growthbook:3100`. The non-default host ports avoid colliding with a candor GrowthBook instance some dev machines run on `127.0.0.1:3030/3100`.

**Bootstrap:**

1. `mise docker:up`
2. Open `http://localhost:3031` → create org + project
3. SDK Connections → Create → copy the **SDK key**
4. `mise env:addkey` → add `GROWTHBOOK_CLIENT_KEY` (target = `be`)
5. Features → Add Feature → key=`use_arq_pipeline`, type=Boolean, default=false (toggle on for ARQ A/B)
6. `mise docker:up` (backend restart picks up the key)

Read flags via `app.observability.is_feature_on("flag_key", default=False)` — returns `default` when the SDK isn't configured / flag doesn't exist / SDK call raises. Always pick `default` so the safer code path runs when GrowthBook is down.

**Active flag:** `use_arq_pipeline` — gates the ARQ two-stage extraction path in `app/services/extraction/pipeline.py`. Default off → legacy single-pass.

## Git workflow — confirm before committing or pushing

**Never run `git commit`, `git push`, `git branch -D`, or any other history-mutating command without explicit confirmation from the user first.** This applies even when "auto mode" is active.

Expected loop:
1. Make edits.
2. Run tests / typecheck / lint to verify.
3. Show `git status` + `git diff --stat` so the user can see what would be committed.
4. **Wait for the user to say "commit" / "push" / "ok"** before running `git commit` or `git push`.
5. After commit, **wait again** before pushing.

When the user does ask for a commit, draft the message and show it for approval — don't run the commit until they confirm.

Branch deletion (local or remote), force-push, and `git reset --hard` always require explicit confirmation, no exceptions.

`main` is a **protected remote branch**. Local `main` should never be ahead of `origin/main`. All work happens on `feat/*` branches and lands via PR.

## Per-stage timing

Use OpenTelemetry spans (already wired in `app/observability.py` + `app/services/extraction/pipeline.py`). With `OTEL_EXPORTER_OTLP_ENDPOINT` empty, spans render to backend stdout — `docker compose logs backend` after a request shows `extract_structured` with child spans `classify`, `chandra_extract`, `pdf2image_render`, `docling_dump`, `llm_agent_run` and their durations. For LLM-specific drill-down (prompts, tokens, cost) use Langfuse at `http://localhost:3001`.
