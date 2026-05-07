"""Pluggable document-extraction architecture.

The shape:

    DoclingArchitecture
      └── extractor   (concrete: ChandraExtractor today;
                       future: SuryaExtractor, GlmOcrExtractor, ...)

Future slots (not yet wired):
      ├── visual_check   (gated, premium-only Gemma 4 visual verifier)
      └── result_writer  (DoclingDocument + HTML reconstruction)

Why this exists:
  Today, `extraction.py` calls Chandra + the docling_adapter inline. Adding
  a Surya self-host path or pivoting to GLM-OCR would be a route-level
  surgery. With this class, swapping the extractor is one line and the
  rest of the pipeline (page rendering, LLM call, persistence, refinement)
  stays untouched.

  The `Extractor` Protocol is the public contract: anything that maps PDF
  bytes → DoclingDocument can plug in. Each impl owns its own provider
  details (Chandra polling, Surya self-host, etc.).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Protocol

from docling_core.types.doc import DoclingDocument

DocType = Literal["delivery_order", "weighing_bill", "invoice", "petrol_bill"]


@dataclass(frozen=True)
class ExtractionArtifacts:
    """Provider-agnostic output of any `Extractor`.

    `chunks_raw` is intentionally `Any`-typed: each provider keeps its own
    raw payload here for downstream debugging / tracing without forcing a
    common chunk schema. The `docling_doc` is what the rest of the app
    consumes.
    """

    docling_doc: DoclingDocument
    markdown: str
    chunks_raw: dict[str, Any] | list[dict[str, Any]] | None
    checkpoint_id: str | None
    page_count: int | None


class Extractor(Protocol):
    """Maps PDF bytes → DoclingDocument."""

    name: str

    async def extract(self, pdf_bytes: bytes, filename: str) -> ExtractionArtifacts: ...


class Classifier(Protocol):
    """Maps PDF bytes → DocType label.

    Cheap visual pre-pass that picks which extraction schema to apply.
    Runs before the extractor so the rest of the pipeline can stay
    schema-specialised. Manual `doc_type` override on the route bypasses
    this entirely (test fixtures, known docs).
    """

    name: str

    async def classify(self, pdf_bytes: bytes, filename: str) -> DocType: ...


class ChandraExtractor:
    """Datalab Chandra OCR API → DoclingDocument.

    Runs Chandra in `mode=accurate, output_format=chunks`, then hands the
    chunks to our existing `docling_adapter` which builds a real
    `DoclingDocument` (with bbox provenance). Markdown view is derived from
    the DoclingDocument so we keep one source of truth.
    """

    name = "chandra"

    async def extract(self, pdf_bytes: bytes, filename: str) -> ExtractionArtifacts:
        # Local imports keep heavy deps (datalab SDK, html parser) lazy.
        from app.services.chandra_ocr import convert_bytes_with_chunks_async
        from app.services.docling_adapter import chunks_to_docling_document

        result = await convert_bytes_with_chunks_async(pdf_bytes, filename)
        if not result.success:
            raise RuntimeError(f"Chandra convert failed: {result.error}")

        doc = chunks_to_docling_document(
            result.chunks,
            name=filename,
            page_count=result.page_count,
        )
        return ExtractionArtifacts(
            docling_doc=doc,
            markdown=doc.export_to_markdown(),
            chunks_raw=result.chunks,
            checkpoint_id=result.checkpoint_id,
            page_count=result.page_count,
        )


@dataclass
class DoclingArchitecture:
    """Composes a `Classifier` + `Extractor` (+ future visual-check, writer).

    The `classifier` slot is optional: routes that pass `doc_type`
    explicitly skip classification entirely. Routes that omit `doc_type`
    invoke `classify()` first and feed the label into `extract()`.
    """

    extractor: Extractor
    classifier: Classifier | None = None

    async def extract(self, pdf_bytes: bytes, filename: str) -> ExtractionArtifacts:
        return await self.extractor.extract(pdf_bytes, filename)

    async def classify(self, pdf_bytes: bytes, filename: str) -> DocType:
        if self.classifier is None:
            raise RuntimeError(
                "no classifier wired on DoclingArchitecture; pass doc_type explicitly"
            )
        return await self.classifier.classify(pdf_bytes, filename)


def default_architecture() -> DoclingArchitecture:
    """Default wiring: Chandra extractor + Gemma classifier."""
    # Lazy import: GemmaClassifier pulls pydantic_ai + pdf2image, keeping
    # this module importable without LLM/render deps for tests.
    from app.services.classifier import GemmaClassifier

    return DoclingArchitecture(
        extractor=ChandraExtractor(),
        classifier=GemmaClassifier(),
    )
