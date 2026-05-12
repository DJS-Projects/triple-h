# Origin: the fork-cleanup that started this repo

This repository is a **reset**, not a genesis. The first commit on `feat/arq-extraction` — `5e30153 Clean fork: consolidate doc_extractor, remove dead code` (Mar 25, 2026) — erased an inherited monolith and kept only the load-bearing pieces. Every commit you see in this repo's history was authored on top of that wiped slate.

The pre-fork state lives upstream. Don't look for it in `git log` here — it is not reachable.

## What the inherited scaffold looked like

The first commit's "remove dead code" delta is the only fossil record we have of the upstream scaffold. Reconstructed from that diff:

- **`hh-app/`** — a Next.js application carrying roughly 22k+ lines across 134 files. Routes for `auth`, `dashboard`, `job-coach`, `upload`, plus accompanying actions, fixtures, and tests. Renamed to `frontend/` in `29bac9f` two commits later, then fully reset in `5e2b267 Reset frontend: bun, biome, clean Next.js structure` (which dropped ~21k deletions against ~1250 fresh insertions).
- **Six near-identical `doc_extractor` variants** — copy-paste forks of the same extraction module, each with its own slight drift. Folded into a single set of modular layers (`ocr.py`, `text_processing.py`, `table_extraction.py`, `json_extraction.py`) in the same first commit.
- **Adjacent cruft** — ChatBot, TTS, wav2lip, and a `pg_db` module. None of these had any connection to the document-extraction problem the product actually needed to solve. All dropped immediately.

The scale tells the story: `5e30153` lands as 134 files / +22391 insertions, and the very next two commits (`29bac9f`, `5e2b267`) move and then re-reset the frontend, removing 20k+ lines net. The new floor was built by shoveling out, not by laying down.

## What was preserved

A handful of things survived the cull because they were doing real work:

- **OCR engines** — Tesseract, PaddleOCR, and PP-Structure all remained in scope. PaddleOCR later became the default (`10b3b1c Switch defaults to gemini-2.5-flash and PaddleOCR, single source of truth`).
- **Dual providers** — Gemini and Ollama both survived as LLM backends. Provider routing later moved behind a LiteLLM proxy (`0ce3b06`), but the two-provider posture predates the proxy.
- **The upload-flow shell** — the basic notion of "user drops a PDF, system returns extracted fields" carried over. The implementation was rewritten end-to-end, but the product shape persisted.
- **A doc-centric data flow** — even before Pattern C was formalized (`5284c2f feat(backend): persist documents, pages, and extraction runs (Pattern C)`), the inherited code organized around document-as-the-unit-of-work. That assumption was preserved.

## What was scrapped immediately

In `5e30153` and the handful of commits that followed:

- **ChatBot, TTS, wav2lip** — out of scope for an extraction service. Removed wholesale.
- **`pg_db` module** — replaced eventually by the SQLAlchemy + Alembic stack inherited from `f9a7e5d Rebuild on nextjs-fastapi-template with eval infrastructure`.
- **Six duplicate `doc_extractor` variants** — collapsed into modular layers. The duplicates were a copy-paste fork pattern from upstream; modularization replaced them with single responsibility files.
- **The 22k-line `hh-app/`** — renamed once, then re-reset clean against a bun + biome Next.js skeleton.

## Why this framing matters for archaeology

Anyone reading this repo's `git log` straight will see a tidy, opinionated stack: LiteLLM proxy, DoclingDocument IR, Pattern C persistence, OpenTelemetry, GrowthBook flags, an ARQ-anchored deterministic Stage 1. They will not see the six-variant `doc_extractor`, the auth flow that was ripped out (`c96e07a`), the LangChain prompt machinery that was deleted (`629d7ca`), or the items CRUD skeleton (`aa89f5d`) that the FastAPI fullstack template ships with by default.

The codebase is **fresh enough that all current decisions are intentional, but old enough that some structure carries inherited assumptions**:

- The `fastapi_backend/` layout still echoes the fastapi-fullstack-template it was rebuilt on (`f9a7e5d`).
- The split between `app/services/extraction/` and `app/refinement/` reflects the DSPy + Gemma refinement experiment in `b171125`, even after the FE bbox overlay was dropped in `4af3a70`.
- `local-shared-data/` exists because of the Chandra probe era, kept after `733c84c` pruned the probes themselves.

Reading the history forward — from `5e30153` outward — is the only way to understand which parts of the current shape are deliberate and which are residue.

## See also

- [timeline.md](./timeline.md) — phase-by-phase walk of the 118 commits.
- [abandoned-paths.md](./abandoned-paths.md) — what was built and then removed, with commit pointers.
