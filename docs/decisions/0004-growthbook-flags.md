# ADR 0004: GrowthBook for feature flags (self-hosted)

- **Status:** Inferred — pending confirmation
- **Date:** 2026-04-28
- **Decider:** DarrenSJZ (sole maintainer)

## Context

The ARQ migration (ADR 0003) needs runtime gating: legacy single-pass must stay the default safe path while ARQ is A/B'd. Future work (model swaps, prompt rewrites, postprocess variants) will need the same shape — toggleable behaviour with safe defaults.

Requirements:

- **Runtime toggle**, not a code branch — flipping requires no redeploy.
- **A/B testability** — eventually we want percentage rollouts, not just on/off.
- **Safe default on failure** — when the flag service is down or misconfigured, the application must take the safer path (usually: do nothing new).
- **No per-seat SaaS cost.** Solo-dev project, no budget for LaunchDarkly-class platforms.

## Decision

- Self-host GrowthBook via Docker Compose. Services in `docker-compose.yml`:
  - `growthbook` — web UI (host `:3031`) + SDK API (host `:3101`, internal `:3100`).
  - `gb-mongo` — MongoDB storage for GrowthBook's own data.
- Non-default host ports (3031 / 3101) avoid colliding with a candor GrowthBook instance some dev machines run on 3030 / 3100.
- Backend reads flags through a single helper: `app.observability.is_feature_on("flag_key", default=False)`.
- **The helper always takes a `default` and returns it** when the GrowthBook SDK isn't configured, the flag doesn't exist, or the SDK call raises. Callers always pick the safer side as `default`.
- Active flag at time of writing: `use_arq_pipeline` (default `false`).

## Consequences

- No SaaS per-seat cost. Total ops cost is two extra containers (`growthbook`, `gb-mongo`) plus their volumes.
- Default-on-fail pattern means a broken GrowthBook never degrades production availability — the worst case is "new feature is silently off until we fix the SDK". This is the right failure mode.
- Bootstrap is manual: create org/project in the UI, copy SDK key, add via `mise env:addkey`. Documented in `CLAUDE.md` lines 79–94 and inline in `docker-compose.yml`.
- A/B percentage rollouts and targeting rules are available when we need them (we currently use the boolean shape only).
- Adds MongoDB to the stack. Not used by anything else in the project; this is GrowthBook's required storage.

## Alternatives considered

- **LaunchDarkly** — best-in-class, but per-seat SaaS pricing is overkill for solo-dev and prevents fully-offline local dev.
- **Statsig** — strong on experimentation, but the platform model is heavier than we need and pricing scales the same way.
- **Unleash (self-hostable)** — viable. Node-heavy stack. Comparable to GrowthBook on features; lost the coin flip on developer ergonomics + maturity of the experiment tooling we may want later.
- **Flagsmith (self-hostable)** — viable. Django-based. Same coin flip outcome.
- **Roll our own (env vars + a small admin page)** — cheap to start, expensive to grow. No targeting, no rollouts, no UI for non-developers. Rejected.

## References

- Source: `CLAUDE.md` "GrowthBook (feature flags)" section (host ports, internal port, bootstrap steps, `is_feature_on` pattern).
- Source: `docker-compose.yml` `growthbook` + `gb-mongo` services (with bootstrap comments inline).
- Source: `fastapi_backend/app/observability.py` (`is_feature_on` helper).
- Related: [open-questions.md](../open-questions.md#3-growthbook-vs-alternatives)
