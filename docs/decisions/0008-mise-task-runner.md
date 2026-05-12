# ADR 0008: mise as the canonical task runner

- **Status:** Accepted
- **Date:** 2026-03 (best estimate, recorded in `CLAUDE.md`)
- **Decider:** DarrenSJZ (sole maintainer)

## Context

The repo has multiple ecosystems living side by side:

- Python 3.12 backend via `uv` (FastAPI, asyncpg, OpenTelemetry, DSPy,
  pydantic-ai, Alembic).
- TypeScript/Next.js frontend via `bun`.
- Docker Compose orchestrating backend + worker + db + litellm + langfuse
  + growthbook + frontend + gb-mongo + langfuse-db (+ ephemeral test-db).
- Alembic migrations.
- dotenvx-encrypted env files (see ADR 0007) that must be unwrapped before
  any tool sees them.

Asking every contributor — or every Claude session — to remember the
correct `dotenvx run -fk ../.env.keys -- uv run alembic upgrade head` form
is a tax on speed and a source of "why doesn't it work" loops. A single
entry point is needed that:

1. Pins the working directory (some tasks must `cd` into
   `fastapi_backend/` or `nextjs-frontend/`).
2. Wraps the dotenvx call so encrypted env vars become plaintext only
   inside the spawned process.
3. Chains dependencies — e.g. `setup` runs both `setup:be` and
   `setup:fe`; `be:test` brings up the ephemeral test DB and tears it
   down via an `EXIT` trap.
4. Manages tool versions (Python, Node, bun, dotenvx CLI, pre-commit) so
   "works on my machine" disappears.

## Decision

Use [mise](https://mise.jdx.dev) as the canonical task runner. All
routine operations are defined in `mise.toml` and invoked as
`mise <task>`. The `[tools]` block in `mise.toml` pins Python 3.12, bun
latest, Node latest, `@dotenvx/dotenvx` (via npm), and pre-commit (via
pipx) — `mise install` brings the whole toolchain up to spec.

Raw `docker compose` / `uv` / `bun` invocations are reserved for
debugging the task layer itself, one-offs not worth promoting, or
read-only state inspection (`docker compose ps`, `docker compose logs`).
`CLAUDE.md` codifies this preference and lists the full task cheatsheet.

## Consequences

- One cheatsheet (the `CLAUDE.md` table) covers the whole dev surface.
- New devs / new Claude sessions run `mise setup` and are productive
  immediately — no per-tool README spelunking.
- The dotenvx pass-through trap (encrypted blobs leaking into containers)
  is solved by routing the `docker compose up` invocation through
  `mise docker:up` / `mise docker:rebuild`, which prefix the command
  with the dotenvx wrapper.
- `mise be:test` and `mise be:test:all` use an `EXIT` trap to ensure the
  test-db container is removed even on Ctrl-C or pytest failure —
  preventing the next run from hitting a port-bound 5433.
- Tasks are discoverable: `mise tasks` enumerates them with
  descriptions; no separate Makefile-style docs to drift.
- Adds one tool to the prerequisites list. The trade is "install mise
  once" vs. "remember and type 4–6 incantations correctly on every
  machine".

## Alternatives considered

- **GNU Make** — no dotenvx integration, no language version
  management, painful tab-vs-space syntax for a non-build-graph use
  case.
- **just** — close to mise in ergonomics, but no language version
  management and no built-in env wrapping.
- **npm scripts (`package.json`)** — single-language; awkward fit for
  Python + Docker + dotenvx orchestration.
- **Bash scripts in `scripts/`** — works but no dependency graph,
  drifts, and easy to forget the dotenvx prefix.
- **Taskfile / go-task** — capable, but Go-centric community and less
  native handling of language-runtime version pinning.

## References

- Source: `CLAUDE.md` lines 3–46 (rationale + full task cheatsheet + the
  raw-compose footgun warning).
- Source: `mise.toml` — `[tools]` block plus all `[tasks.*]` definitions.
