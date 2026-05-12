# Abandoned paths: what was built and removed

These are decisions that died. Each subsection names a feature or approach, the commit that introduced it (when knowable), the commit that killed it, and the inferred reason. Use `git show <hash>` to see the actual diff — the descriptions below are summaries.

The intent of this document is to spare future readers the cycles of asking *"why is there a `local-shared-data/` directory?"* or *"is there auth somewhere?"* The answer to both is no, anymore — and here is the audit trail.

## Auth / dashboard system

- **Introduced:** Inherited from the `fastapi-fullstack-template` rebuild in `f9a7e5d Rebuild on nextjs-fastapi-template with eval infrastructure` (Apr 14). NextAuth-based login, registration, password recovery, and a stub dashboard layout were all part of the template.
- **Killed:** `c96e07a chore(frontend): drop auth/dashboard/design-preview cruft` (May 7, 24 files / -2459).
- **Inferred reason:** The product pivoted from a generic user-facing platform to a single-tenant, document-extraction-focused internal tool. Login, register, password recovery, and the prototype dashboard were unreachable in the new product shape. Design-preview pages were scratch UI exploration superseded by the new review surface.
- **Survivors in the FE:** None — the `__tests__/`, `app/login`, `app/register`, `app/password-recovery`, `app/dashboard`, `app/design-preview`, `components/actions/*` auth stubs, and `proxy.ts` were all removed.
- **Survivors in the BE:** The backend may retain `fastapi-users` references — verify in `fastapi_backend/app/users.py` before assuming the auth layer is fully gone. The FE no longer drives it.

## Chandra probes + stage tracer

- **Introduced:** Pre-OTel observability experiment, gradually built up during Phase 1 in `local-shared-data/` (`_chunks_probe.py`, `_ocr_options_probe.py`, `_sdk_probe.py`, `_tracer.py`). The trace harness commit `d5cfb62 chore(dev): trace harness for stage-by-stage extraction inspection` (May 7, +673) was the high-water mark.
- **Killed:** `733c84c chore: drop unused chandra probes + broken stage tracer` (May 10, -690).
- **Inferred reason:** Replaced by OpenTelemetry, added in `b434609 feat(observability): OpenTelemetry traces + GrowthBook SDK init` (May 10). The probes were one-off Datalab SDK exploration with no live importers; `_tracer.py` had already broken because the extraction-package refactor moved `_MAX_IMAGES_PER_REQUEST`, `_PROMPT_BY_TYPE`, `_SCHEMA_BY_TYPE`, and `_is_vision_model` into the `.pipeline` submodule. OTel manual spans on `extract_structured` now render the same stage timing to backend stdout (or an OTLP endpoint when configured).
- **`.gitignore` consequence:** A `local-shared-data/_*.py` rule was added so future container-owned scratch files (root-on-host because of the bind mount) cannot sneak back into commits.

## LangChain prompt machinery + ground-truth generator

- **Introduced:** Pre-rebuild leftovers carried in from the upstream scaffold via `5e30153` and then `f9a7e5d`. `app/prompt_template.py` (326 lines) and `tests_eval/create_ground_truth.py` (113 lines) imported from a non-existent `doc_extractor/` module and pulled in `langchain_core` which was not in the lockfile.
- **Killed:** `629d7ca chore(backend): remove dead langchain-era files` (May 7, -438).
- **Inferred reason:** Pivot away from LangChain. Direct LiteLLM calls superseded the LangChain layer, and modern prompts now live in `app/services/extraction.py` (`_PROMPT_BY_TYPE`). Neither file could run; the deletion was non-controversial. **Knock-on effect:** because LangChain is gone, **LangSmith is absent as an observability option** — LangSmith requires the LangChain runtime. Langfuse fills that slot instead.

## Items CRUD skeleton

- **Introduced:** Vestigial scaffolding from the `fastapi-fullstack-template` rebuild (`f9a7e5d`, Apr 14). An `Item` ORM model, `app/routes/items.py`, `app/schemas.py` Item DTOs, and `tests/routes/test_items.py` — none of it connected to the extraction or refinement pipeline.
- **Killed:** `aa89f5d chore(backend): remove legacy /items skeleton CRUD` (May 7, -237).
- **Inferred reason:** Domain mismatch. The actual data model is `Document`, `Page`, `ExtractionRun`, and (later) `ExtractionJob` — modeled in `5284c2f feat(backend): persist documents, pages, and extraction runs (Pattern C)` and `39d4796 feat(db): extraction_job table for async queue`. The Item table was deleted by an Alembic migration in the same commit.

## VLM bbox overlay on FE canvas

- **Introduced:** Backend DSPy + Gemma 4 refinement layer in `b171125 feat(backend): VLM refinement layer (DSPy + Gemma) — Phase 1` (May 7, +1552) and `e4cecc3 feat(refine): Phase 2 — bbox grounding via Gemma 4 native box_2d` (May 7, +358). FE rendering in `5de8029 feat(frontend): VLM Refinement panel in design-preview` and `a36d0d7 feat(frontend): render Gemma 4 add-op bboxes on the page canvas`.
- **Killed (FE canvas only):** `4af3a70 refactor(frontend): drop VLM bbox overlay from canvas` (May 7, -94).
- **Inferred reason:** The bbox-on-canvas UX did not justify its complexity. Field-level review via the tabular review UI (`ba2c5e9 feat(frontend): document review UI with layered overlay`, `ace23ca feat(review): per-page KVP filter via field anchors`) was preferred — easier to scan, easier to correct, easier to test.
- **Important:** **Backend DSPy code survives.** The refinement layer in `app/refinement/` is still in tree. Do not conclude DSPy itself is abandoned — only the canvas overlay surface was removed. If a future review surface wants to consume the Gemma 4 `box_2d` output, the backend half is ready.

## Six duplicate `doc_extractor` variants

- **Introduced:** Inherited from upstream — six near-identical copy-paste forks of the same extraction module, pre-fork.
- **Killed:** Folded into modular layers (`ocr.py`, `text_processing.py`, `table_extraction.py`, `json_extraction.py`) in `5e30153 Clean fork: consolidate doc_extractor, remove dead code` (Mar 25), the origin reset.
- **Inferred reason:** Copy-paste fork pattern from the upstream scaffold. Each variant drifted independently with no shared base, making any bug fix or change six different fixes. Modularization replaced them with single-responsibility files. See [origin.md](./origin.md) for fuller context on what else was scrapped at the same time (ChatBot, TTS, wav2lip, pg_db).

## Adminer DB inspector

- **Introduced:** `c25f83a chore(infra): add Adminer DB inspector at :8081` (May 7).
- **Killed:** `88bcc36 chore(docker): drop adminer service` (May 7).
- **Inferred reason:** Lived less than a day. Likely judged not worth the docker-compose surface for a tool that anyone can run as a one-off `docker run` invocation when needed.

## Mailhog dev mail trap

- **Introduced:** Inherited from `f9a7e5d Rebuild on nextjs-fastapi-template with eval infrastructure` (the upstream template includes Mailhog by default).
- **Killed:** `b024893 chore(docker): drop mailhog service` (May 7).
- **Inferred reason:** Auth removal removed the only thing that would send mail (password-reset flows). With no transactional email path, Mailhog became dead docker-compose weight.

## Trace harness output dir (partial)

- **Introduced:** `d5cfb62 chore(dev): trace harness for stage-by-stage extraction inspection` (May 7) wrote output to `/tmp/triple-h-trace/`.
- **Killed:** `8cdfcfd chore(gitignore): exclude trace harness output dir` excluded it from commits; `733c84c` later removed the harness itself.
- **Inferred reason:** Same as Chandra probes — superseded by OpenTelemetry. Listed here as a separate row because the gitignore entry survives even though the harness it protected against is gone.

---

If you find more abandoned paths while exploring, append here with `<feature> — Killed: <hash>` rows. Keep alphabetical or chronological as you prefer. The point is to keep the audit trail readable: any reader should be able to look up *"why isn't there X?"* without `git log -S` archaeology.
