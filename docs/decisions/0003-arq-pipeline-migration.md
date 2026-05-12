# ADR 0003: ARQ two-stage extraction (anchored, deterministic Stage 1)

- **Status:** Inferred — pending confirmation
- **Date:** 2026-05-01
- **Decider:** DarrenSJZ (sole maintainer)

## Context

The legacy single-pass extraction (one vision-LLM call with the rendered markdown + page images) has two production problems:

1. **Non-determinism.** Re-running the same PDF can yield different field values across calls (model temperature effects, sampling, model-revision drift). Hard to debug, hard to regression-test.
2. **No field-level provenance.** When a field value is wrong, there is no way to point at the source line/bbox that produced it. Review UIs and auditors need "this `total_amount` came from this line in this table on page 2" — the single-pass call cannot supply that.

Real-world docs reward grounding. Field names appear next to their values ("Total: RM 4,250.00") or as table headers above them ("Net Weight" column). A deterministic anchor pass can find these candidates cheaply, and an LLM with anchors in context behaves more like a verifier than a free-form extractor.

## Decision

Two-stage extraction, gated by a feature flag:

- **Stage 1 — deterministic anchor extraction:**
  - **Tier-1 anchors:** label-proximity matching. Scan OCR blocks for known field names ("Invoice No.", "Net Weight", "DO No.") and capture the value in the nearest adjacent block. Record source bbox, page, and matched label.
  - **Tier-2 anchors:** table-header alignment. Parse Chandra-emitted block HTML (table cells carry their column headers) using BeautifulSoup + lxml; map values to their column semantics.
  - Output: a list of `FieldProvenance` records (field name, candidate value, bbox, source kind, confidence).
- **Stage 2 — anchored LLM extraction:**
  - Per-doc-type ARQ schemas: `DeliveryOrderARQ`, `WeighingBillARQ`, `InvoiceARQ`, `PetrolBillARQ`. Each schema includes reasoning slots so the model emits its rationale alongside the answer (auditability + DSPy-friendly).
  - Stage 1 anchors are inlined into the prompt. The model verifies / extracts verbatim where an anchor exists, falls back to free extraction only where it must.
- **Rollout via GrowthBook flag `use_arq_pipeline`** (default `false`). Legacy single-pass remains the safe path; toggle on for A/B against legacy.

## Consequences

- **Higher cost per document** — Stage 1 is cheap but Stage 2 prompts grow with anchor count.
- **Higher accuracy on anchored fields**, and field-level provenance enables a review UI that highlights the source for every value.
- **A/B testable.** Flag-gated rollout means we can measure ARQ vs legacy on the eval suite (`mise be:test:eval`) before flipping default.
- **Per-doc-type schemas** mean classification (doc-type detection) becomes a load-bearing upstream step. A misclassified doc runs the wrong ARQ schema.
- **DSPy is in the dependency set** (`dspy-ai>=2.5.0,<3`) so reasoning slots can later be optimised with GEPA against a held-out IoU eval set.

## Alternatives considered

- **Stay on single-pass LLM** — no provenance, non-deterministic, no audit trail. Acceptable for prototypes, not for production logistics docs.
- **Pure regex / heuristic extraction** — brittle across vendors, dies on hand-written values, no semantic reconciliation across fields.
- **Tool-use prompting** (LLM calls retrieval tools mid-extraction) — higher latency, more failure modes, harder to make deterministic; provenance becomes "trust the model's tool calls" rather than recorded anchors.
- **One-shot LLM with structured-output schema only** — gets you typed output but not grounding; the model can still confabulate values that fit the schema.

## References

- Source commits: `1d8a217` (deterministic Stage 1 foundation), `cd1f021` (Tier-1 / Tier-2 anchors + per-doc-type ARQ schemas), `9f6e3d3` (wire ARQ behind GrowthBook flag).
- Source: `fastapi_backend/app/services/extraction/pipeline.py` (flag gate; `use_arq_pipeline` check).
- Source: `fastapi_backend/app/services/extraction/arq.py` (ARQ schemas, reasoning slots).
- Source: `fastapi_backend/app/services/extraction/anchors.py` (Tier-1 / Tier-2 anchor extraction).
- Source: `CLAUDE.md` "Active flag" note ("`use_arq_pipeline` — gates the ARQ two-stage extraction path... Default off → legacy single-pass").
- Source: `fastapi_backend/pyproject.toml` (BeautifulSoup + lxml for block HTML parsing; DSPy for typed Signature programming).
- Related: [open-questions.md](../open-questions.md#2-arq-pipeline-migration)
