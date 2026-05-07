# triple-h — project guide

## Tool execution: prefer `mise` tasks

This project uses [mise](https://mise.jdx.dev/) as the task runner. **Default to `mise <task>` for any operation that has a defined task.** Run `mise tasks` (or read `mise.toml`) before reaching for raw `docker compose`, `uv`, `bun`, `alembic`, or `pytest`.

Why: tasks bundle the dotenvx wrapper (so encrypted env vars decrypt correctly), pin the working directory, and chain dependencies (e.g. `setup` calls `setup:be` + `setup:fe`).

### Task cheatsheet

| Action | Use this |
|--------|----------|
| First-time setup | `mise setup` |
| Start full stack | `mise docker:up` |
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

## Other rules

- Use `uv` (not `pip` / `python -m venv`) for any Python package/runtime ops in `fastapi_backend/`.
- Use `bun` (not `npm` / `pnpm` / `yarn`) for `nextjs-frontend/`.
- Encrypted env files (`fastapi_backend/.env`, `nextjs-frontend/.env`) are decrypted via dotenvx with `.env.keys`. Never commit `.env.keys`.
- All LLM calls go through the LiteLLM proxy at `http://litellm:4000` (config: `litellm/config.yaml`). Don't add direct provider clients to backend code.

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

## Trace harness

For inspecting the extraction pipeline stage-by-stage:

```bash
# End-to-end HTTP timing
/tmp/triple-h-trace/curl-time.sh <pdf-path> [doc_type] [model]

# Per-stage trace with artifact dump
/tmp/triple-h-trace/run.sh <fixture-relative-to-fastapi_backend> [--doc-type X] [--model Y] [--chandra-format json|markdown|chunks] [--step]
```

Artifacts land in `local-shared-data/traces/<run-id>/` (host) ↔ `/app/shared-data/traces/<run-id>/` (container). Each run dumps: input PDF, Chandra raw response + markdown/json variants, rendered page PNGs, full LLM input/output, token usage, per-stage timings.

`--step` drops into pdb between stages. Tracer source: `local-shared-data/_tracer.py`.
