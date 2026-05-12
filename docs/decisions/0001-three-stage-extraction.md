# ADR 0001: Three-stage extraction (Chandra OCR + DoclingDocument IR + vision LLM)

- **Status:** Inferred — pending confirmation
- **Date:** 2026-03-25
- **Decider:** DarrenSJZ (sole maintainer)

## Context

Heng Hup logistics PDFs (delivery orders, weighing bills, invoices, petrol bills) are visually messy: mixed printed and stamped fields, hand-written notes, rotated scans, table cells with column-header context, and inconsistent layouts across vendors. A robust pipeline needs three distinct capabilities:

1. **OCR + structure detection** — turn pixels into text blocks with bounding boxes, so downstream code can reason about position, page number, and provenance.
2. **A stable intermediate representation (IR)** — a schema the rest of the codebase (postprocess, eval tooling, future UIs) can target without binding to the OCR vendor's response shape. If the OCR vendor changes, downstream code shouldn't.
3. **Semantic field extraction** — pull typed fields (dates, totals, party names) with enough world knowledge to handle abbreviations, currency formats, and field-name variants. OCR alone cannot do this.

The decision is to use a separate tool for each, rather than collapsing them.

## Decision

- **OCR + structure: Chandra (Datalab SDK).** End-to-end OCR with layout detection and table cell HTML emitted with column-header context. Authentication, polling, and retries are handled by `datalab-python-sdk`. No local OCR/layout models to maintain.
- **IR: DoclingDocument (schema only).** Use `docling-core` for `DoclingDocument`, `BoundingBox`, `ProvenanceItem`. **Do not** run the full Docling pipeline (its own layout models, OCR, TableFormer). Chandra output is adapted into the DoclingDocument shape; downstream consumers see one stable schema regardless of OCR vendor.
- **Semantic extraction: vision LLM.** Multimodal call (markdown rendering of the IR + page images) via the LiteLLM proxy. Default model is Gemma 4 31B (Ollama Cloud primary, Google AI Studio fallback). Gives the LLM both the OCR-grounded text *and* the visual layout.

## Consequences

- No need to host or maintain OCR / layout / TableFormer infrastructure. Chandra runs as a managed API.
- DoclingDocument gives a stable, well-documented IR with provenance and bboxes. Future tooling (review UI showing field-to-source links, eval harness measuring IoU between predicted and gold bboxes) can target it directly.
- The LLM stage handles semantic gaps OCR cannot cover (abbreviations, party-name resolution, total/subtotal reconciliation).
- Three stages = three failure modes. Each stage needs its own timing span (`chandra_extract`, `docling_dump`, `llm_agent_run`) — wired in `app/observability.py`.
- We are coupled to Chandra availability for OCR. The adapter layer (Chandra → DoclingDocument) is the abstraction seam if we ever swap OCR providers.

## Alternatives considered

- **Chandra-only (no IR layer)** — would couple every downstream consumer (postprocess, eval, UI) to Chandra's response shape. Vendor swap would require touching all of them.
- **Docling full pipeline** — run Docling's own layout models, OCR, TableFormer locally. Duplicates Chandra and adds heavy local infra (GPU-ish memory budgets, model downloads, version pinning). Rejected for solo-dev ops cost.
- **LLM-only on raw PDF images** — skip OCR entirely, hand pages to a vision LLM. No bboxes, no provenance, hallucination-prone on numbers, no eval surface for IoU/anchor metrics.
- **Tesseract / PaddleOCR self-hosted** — viable but solo-dev maintenance burden (CPU/GPU tuning, language packs, regression on new docs). Chandra is a managed alternative that beats self-hosted on the dimensions we care about.

## References

- Source: `fastapi_backend/pyproject.toml` lines 15–24 (DoclingDocument is schema-only; Chandra supplies OCR + structure).
- Source: `fastapi_backend/app/services/extraction/pipeline.py` (stage orchestration + OTel spans `chandra_extract`, `docling_dump`, `llm_agent_run`).
- Source: `CLAUDE.md` "Per-stage timing" section (lists the three pipeline stages by name).
- Related: [open-questions.md](../open-questions.md#1-three-stage-extraction)
