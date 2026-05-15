"""Document type classifier.

Single multimodal LLM call routed through the LiteLLM proxy. The first PDF
page is rasterised at low DPI and shown to a vision model that returns one
of the four supported `DocType` labels.

Used when the upload route receives no explicit `doc_type` form field.
Manual override on the route bypasses this entirely — useful for test
fixtures and pre-known docs.
"""

from __future__ import annotations

import asyncio
import logging
from io import BytesIO
from typing import Literal, cast

from pdf2image import convert_from_bytes
from pydantic import BaseModel, Field
from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.settings import ModelSettings

from app.config import settings
from app.logging_setup import langfuse_call_metadata
from app.services.architecture import DocType

_log = logging.getLogger(__name__)


class UnsupportedDocumentError(Exception):
    """Classifier determined the upload is off-distribution.

    Raised by `GemmaClassifier.classify()` when the model returns the
    `"unsupported"` label — i.e. the upload isn't a delivery_order,
    weighing_bill, invoice, or petrol_bill. The worker catches this
    distinctly from regular pipeline failures: marks the job failed
    with a specific sentinel error so the FE can auto-clean rather
    than leaving a confusing "extraction failed" row in the queue.

    Carries the classifier's `reasoning` string so the user can see
    WHY their upload was rejected (e.g. "this appears to be a research
    paper, not a business document") and decide whether to re-upload
    with an explicit `doc_type` override.
    """

    def __init__(self, reasoning: str) -> None:
        super().__init__(reasoning)
        self.reasoning = reasoning


# Local widening of DocType — adds "unsupported" only for the classifier's
# output schema. We deliberately do NOT add it to architecture.DocType
# because that literal is reused as a DB enum value, schema dict key,
# and prompt key throughout the pipeline. Keeping the rejection label
# scoped to this module avoids a multi-table migration + dict-shape audit.
_ClassifierLabel = Literal[
    "delivery_order", "weighing_bill", "invoice", "petrol_bill", "unsupported"
]


_PROMPT = (
    "Classify this Malaysian scrap-metal trading document into ONE of the labels below.\n\n"
    "Labels:\n"
    "- delivery_order  — DO from supplier/customer; line-item table with material + weight; vehicle plate; DO number\n"
    "- weighing_bill   — Weighbridge slip; gross/tare/net weights; vehicle plate; weighbridge slip number\n"
    "- invoice         — Billing document; line items with qty + unit price + amount; TIN; total billed\n"
    "- petrol_bill     — Fuel station receipt; small ticket; litres + price/litre + RM total; pump #\n"
    "- unsupported     — Anything that is NOT one of the four categories above. Use this for\n"
    "                    research papers, articles, contracts, emails, photos, generic forms,\n"
    "                    or any document whose layout doesn't match the four supported types.\n"
    "                    Prefer `unsupported` over guessing — guessing wrong wastes ~60s of\n"
    "                    downstream compute and produces garbage output.\n\n"
    "Look at the letterhead, overall layout, and distinctive labels. "
    "Return one label and a SHORT reason — 3 to 6 words max, no full "
    "sentences (e.g. 'research paper, no line items' or 'fuel receipt')."
)


class _ClassifierOutput(BaseModel):
    """Structured output schema for the classifier call."""

    doc_type: _ClassifierLabel = Field(
        description="Exactly one of the five allowed labels."
    )
    reasoning: str = Field(
        description="3 to 6 words. No full sentences, no trailing period.",
        max_length=80,
    )


class GemmaClassifier:
    """Vision classifier routed through LiteLLM `gemma-4-31b` model.

    Cost note: a single low-DPI page is sent (~50KB PNG, ~500 input tokens
    once base64-encoded). Latency dominated by network round-trip, not
    inference. Render runs in a thread to avoid blocking the event loop.
    """

    name = "gemma-classifier"

    def __init__(self, model: str = "ollama-gemma4-31b", dpi: int = 100) -> None:
        self.model = model
        self.dpi = dpi

    async def classify(self, pdf_bytes: bytes, filename: str) -> DocType:
        png_bytes = await asyncio.to_thread(self._render_page1, pdf_bytes)
        agent = self._build_agent()
        run = await agent.run(
            [_PROMPT, BinaryContent(data=png_bytes, media_type="image/png")],
            model_settings=ModelSettings(
                extra_body={
                    "metadata": langfuse_call_metadata(
                        filename=filename, model=self.model, purpose="classify"
                    )
                }
            ),
        )
        out: _ClassifierOutput = run.output
        _log.info(
            "classified %s as %s (reason: %s)",
            filename,
            out.doc_type,
            out.reasoning,
        )
        if out.doc_type == "unsupported":
            # Escape hatch — model explicitly says this isn't one of the
            # four valid types. Raise so the pipeline bails BEFORE running
            # OCR + render + the main extraction LLM call. Worker catches
            # this distinctly from regular failures (worker.py) and emits
            # a structured `job_rejected_unsupported_document` event.
            raise UnsupportedDocumentError(out.reasoning)
        # After ruling out `unsupported`, the remaining union is exactly
        # `DocType`. The cast is for mypy — the runtime check above is
        # what actually narrows it.
        return cast(DocType, out.doc_type)

    def _render_page1(self, pdf_bytes: bytes) -> bytes:
        # Render only page 1 — pdf2image accepts first_page/last_page to
        # short-circuit poppler before it walks the whole PDF.
        images = convert_from_bytes(pdf_bytes, dpi=self.dpi, first_page=1, last_page=1)
        if not images:
            raise RuntimeError("could not render page 1 for classification")
        buf = BytesIO()
        images[0].save(buf, format="PNG")
        return buf.getvalue()

    def _build_agent(self) -> Agent[None, _ClassifierOutput]:
        chat = OpenAIChatModel(
            self.model,
            provider=OpenAIProvider(
                base_url=settings.LITELLM_BASE_URL,
                api_key=settings.LITELLM_MASTER_KEY,
            ),
        )
        # PromptedOutput: schema embedded in prompt, parsed client-side.
        # Avoids strict tool-call validators (Gemini/Groq) that reject
        # minor shape mismatches the model would otherwise self-correct.
        return Agent(chat, output_type=PromptedOutput(_ClassifierOutput))
