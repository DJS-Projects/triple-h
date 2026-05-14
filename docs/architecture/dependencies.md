# Dependencies

This project has three dependency domains: the **Python backend** (`fastapi_backend/`), the **Next.js frontend** (`nextjs-frontend/`), and **runtime tools** managed via `mise`. Infrastructure services (Postgres, LiteLLM, Langfuse, GrowthBook, MongoDB) run as Docker containers.

---

## Backend — Python (`fastapi_backend/pyproject.toml`)

### Production dependencies

| Package | Version | Purpose |
|---|---|---|
| `fastapi[standard]` | `>=0.115.0,<0.116` | Web framework. Serves the REST API with automatic OpenAPI doc generation, dependency injection, and async request handling. |
| `asyncpg` | `>=0.29.0,<0.30` | High-performance async PostgreSQL driver. Used by SQLAlchemy for all database operations. |
| `fastapi-users[sqlalchemy]` | `>=13.0.0,<14` | Authentication & user management (registration, login, password reset, email verification). SQLAlchemy backend for persistence. |
| `pydantic-settings` | `>=2.5.2,<3` | Reads configuration from environment variables / `.env` files into typed `Settings` objects. |
| `fastapi-mail` | `>=1.4.1,<2` | Transactional email sending (password resets, verification links). |
| `fastapi-pagination` | `==0.13.3` | Pagination helpers for list endpoints (page/number, limit/offset, cursor). |
| `docling-core` | `>=2.74,<3` | Document data model only (`DoclingDocument`, `BoundingBox`, `ProvenanceItem`). Chandra OCR output is mapped into Docling's document model. |
| `pydantic-ai-slim[openai,google]` | `>=1.80.0,<2` | Typed LLM agent framework. Drives structured extraction calls via LiteLLM to OpenAI, Google, and other providers. |
| `pydantic-graph` | `>=1.80.0,<2` | State-graph execution engine for multi-step extraction pipelines. |
| `pdf2image` | `>=1.17,<2` | Renders PDF pages to PIL images for VLM page input and coordinate-space validation. |
| `datalab-python-sdk` | `>=0.5.0,<1` | Official SDK for Datalab (Chandra OCR) — handles auth, polling, and retries. |
| `aiofiles` | `>=24.1.0,<25` | Async file I/O for the local blob storage backend. |
| `dspy-ai` | `>=2.5.0,<3` | Declarative LLM programming with typed Signatures. Used in the ARQ refinement pipeline for traceable reasoning checkpoints and future GEPA optimization. |
| `pillow` | `>=10.4.0,<12` | Image encoding for VLM payloads and page-render coordinate checks. |
| `beautifulsoup4` | `>=4.12,<5` | HTML parsing of Chandra-emitted block HTML (table cells with column headers) for anchor extraction. |
| `lxml` | `>=5.3,<6` | XML/HTML parser used by BeautifulSoup. |
| `python-dateutil` | `>=2.9,<3` | Tolerant date parsing across multiple formats (MY, ISO, dotted). |
| `rapidfuzz` | `>=3.10,<4` | Fast fuzzy string matching (C++ Levenshtein) for company-name canonicalization in post-processing. |
| `opentelemetry-api` | `>=1.27,<2` | OpenTelemetry tracing API. Vendor-neutral instrumentation interface. |
| `opentelemetry-sdk` | `>=1.27,<2` | OpenTelemetry SDK — trace/span processing, sampling, batching. |
| `opentelemetry-exporter-otlp` | `>=1.27,<2` | OTLP gRPC exporter. Sends traces to a collector (Jaeger, SigNoz, Grafana Tempo) or console when no endpoint is configured. |
| `opentelemetry-instrumentation-fastapi` | `>=0.50b0,<1` | Auto-instrumentation for FastAPI: creates spans per request. |
| `opentelemetry-instrumentation-httpx` | `>=0.50b0,<1` | Auto-instrumentation for httpx: traces outbound HTTP calls. |
| `opentelemetry-instrumentation-asyncpg` | `>=0.50b0,<1` | Auto-instrumentation for asyncpg: traces database queries. |
| `growthbook` | `>=1.2,<2` | Feature-flag and experiment SDK. Reads flag rules from the self-hosted GrowthBook server. |

### Dev dependencies

| Package | Version | Purpose |
|---|---|---|
| `pre-commit` | `>=3.4.0,<4` | Git hook framework for running linters/formatters before every commit. |
| `ruff` | `>=0.11.4,<0.12` | Python linter and formatter (replaces flake8 + isort + black). |
| `watchdog` | `>=5.0.3,<6` | Filesystem watcher for auto-reloading during development. |
| `python-dotenv` | `>=1.0.1,<2` | Loads `.env` files into environment variables. |
| `pytest` | `>=8.3.3,<9` | Test framework. |
| `pytest-mock` | `>=3.14.0,<4` | Thin wrapper around `unittest.mock` for pytest. |
| `mypy` | `>=1.13.0,<2` | Static type checker. |
| `coveralls` | `>=4.0.1,<5` | Test coverage reporting to Coveralls. |
| `alembic` | `>=1.14.0,<2` | Database migration tool (SQLAlchemy-based). |
| `pytest-asyncio` | `>=0.24.0,<0.25` | Async test support for pytest. |
| `mkdocs-material` | `>=9.6.9` | Documentation site generator (Material theme). |
| `mkdocs-material[imaging]` | `>=9.6.9` | Social card image generation for docs. |
| `pytest-cov` | `>=7.1.0` | Coverage plugin for pytest. |
| `pydantic-evals` | `>=1.80.0` | Evaluation framework for structured LLM outputs. |
| `types-aiofiles` | `>=24.1,<25` | Type stubs for aiofiles. |
| `types-python-dateutil` | `>=2.9,<3` | Type stubs for python-dateutil. |

### Build system

| Package | Version | Purpose |
|---|---|---|
| `hatchling` | (build requirement) | PEP 517 build backend. |

---

## Frontend — Node.js (`nextjs-frontend/package.json`)

### Production dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | `16.0.8` | React framework with SSR, static generation, and App Router. |
| `react` | `19.2.1` | UI library. |
| `react-dom` | `19.2.1` | React DOM renderer. |
| `@heroicons/react` | `^2.2.0` | SVG icon set (outline + solid) as React components. |
| `@hey-api/client-axios` | `^0.9.1` | Axios-based HTTP client generated from the backend OpenAPI spec. |
| `@hey-api/client-fetch` | `^0.13.1` | Fetch-based HTTP client generated from the backend OpenAPI spec. |
| `@hookform/resolvers` | `^3.9.1` | Validation resolvers for react-hook-form (Zod integration). |
| `@radix-ui/react-avatar` | `^1.1.1` | Accessible avatar component primitive. |
| `@radix-ui/react-dropdown-menu` | `^2.1.2` | Accessible dropdown menu primitive. |
| `@radix-ui/react-icons` | `^1.3.0` | Icon set from the Radix team. |
| `@radix-ui/react-label` | `^2.1.0` | Accessible label primitive. |
| `@radix-ui/react-scroll-area` | `^1.2.10` | Accessible scroll area primitive. |
| `@radix-ui/react-select` | `^2.2.5` | Accessible select menu primitive. |
| `@radix-ui/react-slot` | `^1.1.0` | Slot composition primitive (used by Radix's `asChild` pattern). |
| `@radix-ui/react-tabs` | `^1.1.1` | Accessible tabs primitive. |
| `axios` | `^1.7.9` | HTTP client for API calls. |
| `class-variance-authority` | `^0.7.0` | Utility for managing component variant classes (Tailwind-friendly). |
| `clsx` | `^2.1.1` | Tiny className concatenation utility. |
| `lucide-react` | `^0.452.0` | Open-source icon set as React components. |
| `react-hook-form` | `^7.54.0` | Performant form state management. |
| `react-icons` | `^5.4.0` | Popular icon packs bundled as React components. |
| `tailwind-merge` | `^2.5.4` | Merges Tailwind class strings, resolving conflicts. |
| `tailwindcss-animate` | `^1.0.7` | Tailwind plugin for CSS animation utilities. |
| `zod` | `^3.23.8` | Schema declaration and validation library. |

### Dev dependencies

| Package | Version | Purpose |
|---|---|---|
| `@biomejs/biome` | `^2.4.11` | Linter and formatter (successor to ESLint + Prettier). |
| `@hey-api/openapi-ts` | `^0.83.1` | TypeScript client code generator from OpenAPI specs. |
| `@types/node` | `^20` | TypeScript type definitions for Node.js APIs. |
| `@types/react` | `19.2.7` | TypeScript type definitions for React. |
| `@types/react-dom` | `19.2.3` | TypeScript type definitions for React DOM. |
| `autoprefixer` | `^10.4.20` | PostCSS plugin that adds vendor prefixes. |
| `postcss` | `^8.4.47` | CSS transformation tool (Tailwind dependency). |
| `tailwindcss` | `^3.4.13` | Utility-first CSS framework. |
| `tw-animate-css` | `^1.4.0` | Tailwind-compatible animation classes. |
| `typescript` | `^5` | TypeScript compiler. |

---

## Runtime tools (`mise.toml`)

These tools are installed via `mise` and are available as development dependencies on the host machine.

| Tool | Version | Purpose |
|---|---|---|
| `python` | `3.12` | Python runtime for the backend. Pinned to 3.12.x. |
| `bun` | `latest` | JavaScript runtime and package manager for the frontend. |
| `node` | `latest` | Node.js runtime (used by Biome, Next.js build, etc.). |
| `npm:@dotenvx/dotenvx` | `latest` | Env-file encryption/decryption tool. Wraps all `mise` tasks that need secrets. |
| `pipx:pre-commit` | `latest` | Git hook manager, installed globally via pipx. |

---

## Infrastructure services (`docker-compose.yml`)

| Service | Image | Purpose |
|---|---|---|
| `db` | `postgres:17` | Main application database. |
| `litellm` | `ghcr.io/berriai/litellm:main-latest` | OpenAI-compatible proxy that routes LLM calls to multiple providers (Groq, NVIDIA NIM, OpenRouter, Google, Doubleword, Ollama). All backend LLM calls go through this proxy. |
| `langfuse` | `langfuse/langfuse:2` | LLM observability: captures prompt/completion, tokens, cost, latency via LiteLLM's `success_callback`. |
| `langfuse-db` | `postgres:17` | Dedicated Postgres for Langfuse data. |
| `growthbook` | `growthbook/growthbook:latest` | Self-hosted feature-flag and experiment server. Web UI on port 3031, SDK API on port 3101. |
| `gb-mongo` | `mongo:7` | MongoDB instance for GrowthBook data. |
| `test-db` | `postgres:17` | Ephemeral Postgres for integration tests (profile: test only). |
| `frontend` | (builds from `nextjs-frontend/`) | Next.js production build served via Docker. |
| `backend` | (builds from `fastapi_backend/`) | FastAPI Uvicorn server. |
| `worker` | (builds from `fastapi_backend/`) | Background job worker that polls `extraction_job` table and runs extraction pipelines. |
