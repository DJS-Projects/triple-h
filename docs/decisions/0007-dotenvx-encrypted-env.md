# ADR 0007: Encrypted `.env` files via dotenvx

- **Status:** Accepted
- **Date:** 2026-03 (best estimate, recorded in `CLAUDE.md`)
- **Decider:** DarrenSJZ (sole maintainer)

## Context

The project depends on a non-trivial set of third-party credentials:
LiteLLM provider keys (Groq, NVIDIA NIM, Google AI Studio, Ollama Cloud,
Doubleword), Chandra OCR (Datalab) API key, Langfuse public + secret
keys, GrowthBook SDK key, and three FastAPI-Users auth secrets
(`ACCESS_SECRET_KEY`, `RESET_PASSWORD_SECRET_KEY`,
`VERIFICATION_SECRET_KEY`).

The conventional approach — `.env.example` committed, real `.env`
gitignored — works but creates friction for a solo dev across multiple
machines: every new clone is a manual rebuild of the secret set, and
there is no canonical source of truth for "which secrets does this
project need right now". The repo also wants to remain shareable
(public, or with collaborators) without leaking keys.

A runtime secret manager (Vault, Doppler, Infisical, 1Password CLI) would
solve the source-of-truth problem but adds a hard external dependency for
local dev — `mise docker:up` on a fresh clone would block on signing into
a SaaS dashboard.

## Decision

Commit `fastapi_backend/.env` and `nextjs-frontend/.env` to git **in
encrypted form** using [dotenvx](https://dotenvx.com). The plaintext
decryption key lives in `.env.keys` at repo root and is **never
committed** (gitignored).

All routine commands run through a mise task wrapper that invokes
`dotenvx run -fk .env.keys -- <cmd>`, decrypting values into the child
process environment at execution time. See `mise.toml`: `be:dev`,
`fe:dev`, `docker:up`, `docker:rebuild`, `be:db:migrate`, etc.

A dedicated `mise env:addkey` task lets the maintainer paste a new secret
without it appearing in shell history, the agent transcript, or the file
on disk — `scripts/env_addkey.py` reads via `getpass` and writes through
dotenvx encrypt.

## Consequences

- Repository can be public without leaking secrets. The encrypted
  `encrypted:BAse64...` blobs in committed `.env` files are useless
  without `.env.keys`.
- A single canonical list of "what secrets does this project need"
  lives in version control.
- Onboarding a new machine: clone, drop `.env.keys` in repo root
  out-of-band, run `mise setup`. No SaaS round-trip.
- **Footgun:** running raw `docker compose up --build` bypasses the
  dotenvx wrapper. The container then gets the literal
  `encrypted:...` strings as env values and the app boots half-blind
  (LiteLLM falls back to no-key, GrowthBook silently disables, etc.).
  `CLAUDE.md` warns about this explicitly and directs every code-change
  rebuild through `mise docker:rebuild` (which adds `--force-recreate`
  so compose actually swaps the container).
- `.env.keys` distribution is a manual out-of-band step. For a solo dev
  this is fine; if the team grows, a real secret manager will need to
  take over.

## Alternatives considered

- **Plain `.env` not committed + `.env.example`** — devs hand-fill on
  every clone, easy to drift, no canonical secret list.
- **Doppler / Infisical / 1Password CLI** — solves source-of-truth but
  introduces a SaaS dependency for the simplest local boot.
- **HashiCorp Vault** — heavyweight for solo-dev scale; significant ops
  surface for marginal benefit at current size.
- **git-crypt** — committed encrypted blobs, but clunky shell/tool
  integration and the whole-file model is less ergonomic than
  per-key dotenvx encryption.
- **Pass credentials via shell environment only** — no canonical list,
  fragile across machines, breaks the "fresh clone just works" goal.

## References

- Source: `CLAUDE.md` lines 3–19 (mise + dotenvx wrapper rationale), line
  44 (the raw `docker compose up --build` footgun), lines 47–52 (env
  rules).
- Source: `mise.toml` — `env:encrypt`, `env:decrypt`, `env:addkey` tasks
  plus every dev/docker task that wraps with `dotenvx run -fk ../.env.keys`.
- Source: `scripts/env_addkey.py` — interactive silent-paste helper.
