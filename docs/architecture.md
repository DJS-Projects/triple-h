# Triple-H Architecture

End-to-end view of the document extraction + review system as it stands
on `feat/extraction-and-review`.

## System diagram

```mermaid
flowchart LR
    User([Reviewer])

    subgraph FE["Next.js · :3000"]
        Page["/design-preview"]
        KVP["KVP table<br/>(flat JSON)"]
        Canvas["Page canvas<br/>+ Live Text<br/>+ OCR bboxes"]
        Panel["Refinement panel<br/>(ARQ + patches)"]
    end

    subgraph BE["FastAPI · :8000"]
        direction TB
        Auth[fastapi-users<br/>JWT auth]

        subgraph Routes
            R1["POST /extract/structured"]
            R2["POST /refine/{run_id}"]
            R3["GET /documents/{id}/extraction"]
        end

        subgraph ExtractSvc["Extraction"]
            Chandra["chandra_ocr.py<br/>(Datalab SDK)"]
            Docling["docling_adapter.py"]
            Pdf2img["pdf2image · 150 DPI"]
            ExtractPipe["extraction.py<br/>ARQ-structured LLM call"]
        end

        subgraph RefineSvc["Refinement (DSPy)"]
            Sig["signatures.py<br/>RefineScaffold@v2<br/>+ ARQ checkpoints"]
            Pipe["pipeline.py<br/>refine_scaffold()"]
            Apply["apply_patches.py<br/>(pure fn)"]
            Coords["coords.py<br/>1000-norm ↔ PDF pts"]
        end

        Persist["persistence.py<br/>(Pattern C, no commit in helpers)"]
        Blob["blob_store.py<br/>(local FS · pluggable)"]
    end

    subgraph LL["LiteLLM proxy · :4000"]
        direction TB
        VPrim[vision-primary]
        VFall[vision-fallback-1]
        VRef[refinement-vlm]
        SPrim[structured-primary]
    end

    subgraph Ext["External"]
        Datalab[("Datalab<br/>Chandra OCR")]
        Groq[("Groq")]
        NIM[("NVIDIA NIM")]
        Gemini[("Google Gemini")]
        Doubleword[("Doubleword")]
    end

    subgraph Store["Storage"]
        DB[("Postgres 17<br/>document<br/>document_page<br/>extraction_run<br/>field_review<br/>refinement_run")]
        Disk[("Blob store<br/>PDFs + page PNGs<br/>/data/blobs")]
    end

    Adminer["Adminer · :8081<br/>(DB inspector)"]

    User -->|upload PDF / review| Page
    Page --> KVP
    Page --> Canvas
    Page --> Panel

    Page --> R1
    Page --> R2
    Page --> R3
    R1 & R2 & R3 -.->|guarded by| Auth

    R1 --> ExtractPipe
    ExtractPipe --> Chandra
    ExtractPipe --> Pdf2img
    Chandra --> Datalab
    Chandra --> Docling
    ExtractPipe -->|"Chandra md + page PNGs<br/>multimodal call"| VPrim
    ExtractPipe --> Persist

    R2 --> Persist
    R2 --> Pipe
    Pipe --> Sig
    Sig -->|"image + scaffold +<br/>field schema"| VRef
    VRef -->|"box_2d in 1000×1000"| Sig
    Sig --> Apply
    Apply --> Coords
    Pipe --> Persist

    R3 --> Persist

    VPrim --> Groq
    VFall --> NIM
    VRef --> Gemini
    SPrim --> Doubleword

    Persist --> DB
    Blob --> Disk
    Adminer -.->|read-only| DB
```

## How to read it

Three planes left-to-right:

1. **Frontend** — single `/design-preview` page renders three views over
   the same data: KVP fields, page canvas with Live Text + OCR bboxes,
   refinement panel showing ARQ trace and patches.
2. **Backend (FastAPI)** — Routes thin wrappers over two service
   subgraphs (Extraction, Refinement). `persistence.py` is the
   single-writer for domain tables. `blob_store.py` is pluggable.
3. **LiteLLM + External** — every model call funnels through LiteLLM
   virtual models. Provider swap is a `litellm/config.yaml` edit.

## Two main flows

### Extraction (cold path)

```
PDF
  → Chandra OCR (markdown + DoclingDocument scaffold)
  + pdf2image (page PNGs at 150 DPI)
  → multimodal LLM via vision-primary
  → typed extracted record (ARQ-structured)
  → persisted as extraction_run (immutable, append-only)
```

### Refinement (warm path, optional)

```
extraction_run
  → load DoclingDocument scaffold + page PNG
  → DSPy.RefineScaffold@v2 with three ARQ checkpoints
  → Gemma 4 31B emits patches (assign / reject / add / move) with box_2d
  → coords.py converts 1000-norm → PDF points
  → apply_patches builds scaffold_out
  → persisted as refinement_run (immutable, is_current flips)
```

## Refinement sequence diagram

```mermaid
sequenceDiagram
    autonumber
    actor R as Reviewer
    participant FE as Frontend
    participant API as FastAPI<br/>/refine/{run_id}
    participant DB as Postgres
    participant BS as Blob store
    participant DSPy as DSPy<br/>RefineScaffold@v2
    participant LL as LiteLLM<br/>refinement-vlm
    participant G as Gemma 4 31B<br/>(Google API)

    R->>FE: hit /design-preview
    FE->>API: POST /refine/2?page_no=1
    API->>DB: load extraction_run
    API->>DB: load document_page
    API->>BS: fetch page PNG bytes
    API->>DSPy: refine_scaffold(image, scaffold, field_keys)
    DSPy->>LL: chat completion w/ image + scaffold
    LL->>G: gemma-4-31b-it generate
    G-->>LL: ARQ trace + patches (box_2d)
    LL-->>DSPy: structured output
    DSPy->>DSPy: apply_patches(scaffold, patches)
    DSPy-->>API: RefinementOutcome
    API->>DB: UPDATE prior is_current = false
    API->>DB: INSERT refinement_run (is_current = true)
    API-->>FE: { result, scaffold_out, refinement_run_id }
    FE-->>R: render Refinement panel + bboxes
```

## Database schema (relevant subset)

```mermaid
erDiagram
    document ||--o{ document_page : "1..N pages"
    document ||--o{ extraction_run : "history"
    extraction_run ||--o{ field_review : "human edits"
    extraction_run ||--o{ refinement_run : "VLM passes"
    user ||--o{ document : "uploads"
    user ||--o{ field_review : "reviewer"

    document {
        uuid document_id PK
        uuid uploaded_by FK
        text filename
        bigint size_bytes
        text blob_key
        text sha256 UK
        int page_count
        enum doc_type
        enum status
        timestamptz created_at
    }

    document_page {
        uuid document_id PK "FK to document"
        int page_no PK
        int width_px
        int height_px
        text blob_key
    }

    extraction_run {
        bigint extraction_run_id PK
        uuid document_id FK
        enum doc_type
        text llm_model
        text checkpoint_id
        int duration_ms
        jsonb payload
        bool is_current
        timestamptz created_at
    }

    field_review {
        bigint field_review_id PK
        bigint extraction_run_id FK
        uuid reviewer_id FK
        text field_path
        jsonb original_value
        jsonb edited_value
        text remark
        timestamptz created_at
    }

    refinement_run {
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

## Key invariants

- **`persistence.py` is the single writer** for domain tables. Routes
  never construct ORM objects directly; they call into helpers.
- **All LLM/VLM calls funnel through LiteLLM**. No direct provider
  SDK imports in business logic. Provider swap is one yaml edit.
- **Original artifacts preserved verbatim** — `scaffold_in`,
  `payload`, `original_value`. Patches/edits stored separately so
  any state can be replayed and reverted.
- **Pattern C append-only history**: every mutation table has
  `is_current` with a partial-unique constraint
  (`uq_*_one_current_per_*`). Demote prior row before inserting
  new one inside the same transaction.
- **Blob store is pluggable** (`BLOB_BACKEND=local|s3`). Same
  interface, S3 swap is a config flip.
- **DSPy Signatures are versioned** via `PROMPT_VERSION` constant
  persisted on every refinement_run row. Prompt drift is auditable.

## Service inventory (docker compose)

| Service | Port | Purpose |
|---------|------|---------|
| `frontend` | 3000 | Next.js dev server, `/design-preview` |
| `backend` | 8000 | FastAPI, async SQLAlchemy, fastapi-users |
| `litellm` | 4000 | OpenAI-compatible proxy fronting all providers |
| `db` | 5432 | Postgres 17 |
| `adminer` | 8081 | Browser DB inspector |
| `mailhog` | 1025 / 8025 | SMTP capture for fastapi-users emails |

## Repo layout (relevant subset)

```
fastapi_backend/
├── app/
│   ├── routes/
│   │   ├── extract.py        ← POST /extract/structured
│   │   ├── refine.py         ← POST /refine/{run_id}
│   │   └── documents.py      ← GET /documents/...
│   ├── services/
│   │   ├── chandra_ocr.py    ← Datalab SDK wrapper
│   │   ├── docling_adapter.py
│   │   ├── extraction.py     ← cold-path pipeline
│   │   ├── persistence.py    ← single writer
│   │   ├── blob_store.py     ← pluggable
│   │   └── extraction_overlay.py  ← read-side merge
│   ├── refinement/
│   │   ├── signatures.py     ← DSPy RefineScaffold@v2
│   │   ├── pipeline.py       ← refine_scaffold()
│   │   ├── apply_patches.py  ← pure fn
│   │   ├── coords.py         ← 1000-norm ↔ PDF pts
│   │   └── schemas.py        ← Pydantic types
│   ├── models.py             ← SQLAlchemy ORM
│   └── main.py
├── alembic_migrations/versions/
└── tests/
    ├── test_apply_patches.py
    └── ...

nextjs-frontend/
├── app/
│   ├── design-preview/
│   │   └── page.tsx          ← KVP + canvas + Live Text + Refine panel
│   ├── globals.css
│   └── layout.tsx
└── lib/fixtures/
    └── refinement-run-2.json ← live /refine response, swapped for
                                 fetch when GET endpoint lands

litellm/
└── config.yaml               ← virtual models + fallbacks

docker-compose.yml
mise.toml                     ← task runner entrypoint
```
