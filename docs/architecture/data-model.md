# Data model

Seven tables in one Postgres database, all defined in
`fastapi_backend/app/models.py`. `user` is the pre-existing
fastapi-users table on the legacy 1.x `Column(...)` style; the other
six are domain tables on the modern 2.x `Mapped[...] / mapped_column`
style. JSON-shaped extraction payloads live in `extraction_run.payload`
(JSONB with a GIN index). Append-only history is the dominant pattern:
extractions, field reviews, and refinements all add rows rather than
mutate them, with `is_current` partial unique indexes to mark the
canonical row per parent.

## TL;DR

`document` is the public entity (UUID PK, in URLs).
`document_page` caches per-page rendered PNGs for review-UI speed.
`extraction_run` is append-only with one `is_current=true` row per
document. `extraction_job` is the work queue. `field_review` audits
human edits. `refinement_run` audits VLM-driven OCR scaffold patches.
`user` is fastapi-users.

## ER diagram

```mermaid
erDiagram
  USER ||--o{ DOCUMENT : uploads
  DOCUMENT ||--o{ DOCUMENT_PAGE : has
  DOCUMENT ||--o{ EXTRACTION_RUN : has
  DOCUMENT ||--o{ EXTRACTION_JOB : has
  EXTRACTION_RUN ||--o{ FIELD_REVIEW : audits
  EXTRACTION_RUN ||--o{ REFINEMENT_RUN : scaffolds
  EXTRACTION_RUN ||--o| EXTRACTION_JOB : produced_by
  USER ||--o{ FIELD_REVIEW : authors

  USER {
    uuid id PK
    string email
    string hashed_password
    bool is_active
    bool is_superuser
    bool is_verified
  }

  DOCUMENT {
    uuid document_id PK
    uuid uploaded_by FK
    text filename
    text mime_type
    bigint size_bytes
    text blob_key
    text sha256 UK
    int page_count
    enum doc_type
    enum status
    timestamptz created_at
    timestamptz updated_at
  }

  DOCUMENT_PAGE {
    uuid document_id PK_FK
    int page_no PK
    int width_px
    int height_px
    text blob_key
    timestamptz rendered_at
  }

  EXTRACTION_RUN {
    bigint extraction_run_id PK
    uuid document_id FK
    enum doc_type
    text schema_version
    text llm_model
    text checkpoint_id
    int duration_ms
    jsonb payload
    bool is_current
    timestamptz created_at
  }

  EXTRACTION_JOB {
    uuid job_id PK
    uuid document_id FK
    text idempotency_key
    text content_hash
    text model
    enum doc_type
    enum status
    text stage
    text error
    bigint run_id FK
    int attempts
    int max_attempts
    timestamptz locked_until
    timestamptz created_at
    timestamptz started_at
    timestamptz finished_at
    jsonb request_meta
  }

  FIELD_REVIEW {
    bigint field_review_id PK
    bigint extraction_run_id FK
    uuid reviewer_id FK
    text field_path
    jsonb original_value
    jsonb edited_value
    text remark
    timestamptz created_at
  }

  REFINEMENT_RUN {
    bigint refinement_run_id PK
    bigint extraction_run_id FK
    text vlm_model
    text prompt_version
    jsonb scaffold_in
    jsonb scaffold_out
    jsonb patches
    jsonb arq_trace
    jsonb token_usage
    int duration_ms
    bool is_current
    timestamptz created_at
  }
```

## Table notes

### `user`

`models.py:52-58`. fastapi-users `SQLAlchemyBaseUserTableUUID` plus a
relationship back to `Document`. `Document.uploaded_by` references
`user.id` with `ondelete="RESTRICT"` — users with documents can't be
deleted.

### `document`

`models.py:87-156`. PK is a server-generated UUID
(`func.gen_random_uuid()`). Unique constraint on `sha256` is the
de-dedup hook used by `persistence.ingest_document` so uploading the
same bytes twice returns the existing row.

Status is a Postgres enum `doc_status` with values
`uploaded | processing | extracted | reviewed | failed`
(`models.py:67-77`). Partial index `ix_document_status_open` covers
non-reviewed rows for queue-style queries
(`postgresql_where="status <> 'reviewed'"`, `models.py:151-155`).

Check constraints: `size_bytes > 0`, `page_count > 0 OR NULL`.

### `document_page`

`models.py:159-185`. Composite PK `(document_id, page_no)`. One row per
PDF page; stores rendered PNG metadata (width, height, blob key)
populated by `persistence.record_pages` at the end of every worker
run. `blob_key` points into the same blob store the PDF bytes live in.
`ondelete="CASCADE"` so deleting a document cleans up pages
automatically.

### `extraction_run`

`models.py:188-258`. Append-only history. `extraction_run_id` is a
server-generated identity column. `payload` is JSONB with a structure
written by the worker at `worker.py:130-137`:

```python
{
  "extracted": <flat dict, schema-coerced>,
  "markdown": <Chandra OCR markdown>,
  "docling_doc": <DoclingDocument as JSON>,
  "chandra_chunks": <Chandra chunks dict or null>,
  "pipeline_variant": "single_pass" | "arq",
  "envelope": <ExtractionEnvelope JSON or null>,
}
```

Two load-bearing indexes:

- `uq_extraction_run_one_current_per_doc` — partial unique
  `WHERE is_current` on `document_id` (`models.py:246-251`). Guarantees
  at most one current row per document; flipping is the persistence
  layer's job on re-extraction.
- `ix_extraction_run_payload_gin` — GIN index using `jsonb_path_ops`
  on `payload` (`models.py:252-257`) for offline eval queries that
  filter by extracted field values.

Check constraints: `duration_ms >= 0`, `jsonb_typeof(payload) = 'object'`.

### `extraction_job`

`models.py:392-523`. The async work queue (see
[async-job-queue.md](async-job-queue.md)). PK is a UUID; `status` is
enum `extraction_job_status` with values
`pending | running | succeeded | failed` (`models.py:79-84`).

Three partial unique indexes enforce idempotency:

- `uq_extraction_job_idem_active` on `idempotency_key`
  `WHERE status IN ('pending', 'running', 'succeeded')` — primary
  dedup, client-supplied key.
- `uq_extraction_job_content_active_typed` on
  `(content_hash, model, doc_type)` same status filter, additionally
  `doc_type IS NOT NULL`.
- `uq_extraction_job_content_active_auto` on
  `(content_hash, model)` same status filter, additionally
  `doc_type IS NULL`.

The split-by-NULL trick exists because Postgres requires expressions
in index predicates to be IMMUTABLE, and `COALESCE(doc_type, 'auto')`
introduces a STABLE enum-to-text cast that disqualifies the
expression (`models.py:485-507`).

Three operational indexes:

- `ix_extraction_job_pending_queue` on `created_at`
  `WHERE status = 'pending'` — claim loop scan target.
- `ix_extraction_job_stalled_leases` on `locked_until`
  `WHERE status = 'running' AND locked_until IS NOT NULL` — sweeper
  scan target.
- `ix_extraction_job_doc_created` on `(document_id, created_at)` —
  history-by-document queries.

`run_id` FK to `extraction_run` with `ondelete="SET NULL"` — the job
audit row outlives a deleted run, just loses the back-pointer.

### `field_review`

`models.py:261-302`. Append-only log of human edits. `field_path` is
the FE-flattened path (e.g. `vehicle_number`, `items[0].description`).
`original_value` and `edited_value` are JSONB to handle any field
type. `reviewer_id` references `user.id` with `ondelete="RESTRICT"`
so reviewers can't be deleted while their audit rows exist.

Indexes:

- `ix_field_review_reviewer` on `reviewer_id`.
- `ix_field_review_extraction_field` on
  `(extraction_run_id, field_path)`.

### `refinement_run`

`models.py:305-389`. Append-only history of VLM-driven OCR scaffold
patches. One run per `(extraction_run_id, refinement attempt)`. Stores
the input scaffold (`scaffold_in`), the patched scaffold
(`scaffold_out`), the list of typed `BBoxPatch` operations
(`patches`), and the structured ARQ trace from the DSPy Signature
(`arq_trace`).

Same `is_current` pattern as `extraction_run`:
`uq_refinement_run_one_current_per_extraction` partial unique
`WHERE is_current` on `extraction_run_id` (`models.py:383-388`).

Check constraints: `duration_ms >= 0`, `jsonb_typeof(scaffold_in/out) = 'object'`,
`jsonb_typeof(patches) = 'array'`.

## `is_current` semantics

`extraction_run.is_current` and `refinement_run.is_current` exist
because we keep history append-only but the UI usually only wants the
canonical row. The persistence layer is responsible for flipping the
previous current row to `false` *before* inserting the new
`is_current=true` row, inside the same transaction. The partial unique
index guarantees the invariant at the storage layer: at most one
`is_current=true` row per document (or extraction_run).

## Alembic migration timeline

Migrations live in
`fastapi_backend/alembic_migrations/versions/`. Listed in `down_revision` order:

1. `402d067a8b92_added_user_table.py` — `2024-09-27` — initial
   fastapi-users `user` table.
2. `b389592974f8_add_item_model.py` — `2024-12-06` — legacy `items`
   demo table (later dropped).
3. `3e2514bc236e_add_document_page_extraction_run_field_review.py` —
   `2026-05-06` — domain tables (`document`, `document_page`,
   `extraction_run`, `field_review`) plus enums and indexes.
4. `9f4136a07caf_add_refinement_run_table.py` — `2026-05-07` —
   `refinement_run` for VLM scaffold patches.
5. `f80865750e97_drop_legacy_items_table.py` — `2026-05-07` — drop the
   demo table.
6. `763895bd69c3_add_extraction_job_table.py` — `2026-05-11` — async
   queue table with idempotency indexes and the `extraction_job_status`
   enum.

Migration `3e2514bc236e` documents two style rules adopted from the
alembic-expert guidance: indexes on brand-new empty tables are created
non-concurrently (no concurrent write traffic to block) and
single-column indexes whose leading column is already the leftmost
column of a composite index are intentionally omitted.

## Cross-links

- How the worker writes `extraction_run` rows: [async-job-queue.md](async-job-queue.md)
- Shape of `payload.extracted` per doc-type:
  [extraction-pipeline.md](extraction-pipeline.md) (stage table) and
  `tests_eval/schemas.py`
- Schema decisions and history: [decisions/](../decisions/),
  [history/timeline.md](../history/timeline.md)
