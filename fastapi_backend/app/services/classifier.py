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

from pdf2image import convert_from_bytes
from pydantic import BaseModel, Field
from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.config import settings
from app.services.architecture import DocType

_log = logging.getLogger(__name__)

_PROMPT = (
    "Classify this Malaysian scrap-metal trading document into ONE of the labels below.\n\n"
    "Labels:\n"
    "- delivery_order  — DO from supplier/customer; line-item table with material + weight; vehicle plate; DO number\n"
    "- weighing_bill   — Weighbridge slip; gross/tare/net weights; vehicle plate; weighbridge slip number\n"
    "- invoice         — Billing document; line items with qty + unit price + amount; TIN; total billed\n"
    "- petrol_bill     — Fuel station receipt; small ticket; litres + price/litre + RM total; pump #\n\n"
    "Look at the letterhead, overall layout, and distinctive labels. "
    "Return one label and a one-sentence reason grounded in what you see."
)


class _ClassifierOutput(BaseModel):
    """Structured output schema for the classifier call."""

    doc_type: DocType = Field(description="Exactly one of the four allowed labels.")
    reasoning: str = Field(description="One sentence citing visual evidence.")


class GemmaClassifier:
    """Vision classifier routed through LiteLLM `refinement-vlm` virtual model.

    Cost note: a single low-DPI page is sent (~50KB PNG, ~500 input tokens
    once base64-encoded). Latency dominated by network round-trip, not
    inference. Render runs in a thread to avoid blocking the event loop.
    """

    name = "gemma-classifier"

    def __init__(self, model: str = "refinement-vlm", dpi: int = 100) -> None:
        self.model = model
        self.dpi = dpi

    async def classify(self, pdf_bytes: bytes, filename: str) -> DocType:
        png_bytes = await asyncio.to_thread(self._render_page1, pdf_bytes)
        agent = self._build_agent()
        run = await agent.run(
            [_PROMPT, BinaryContent(data=png_bytes, media_type="image/png")]
        )
        out: _ClassifierOutput = run.output
        _log.info(
            "classified %s as %s (reason: %s)",
            filename,
            out.doc_type,
            out.reasoning,
        )
        # Pydantic Literal field is statically typed, mypy needs the explicit
        # cast through the local annotation above; this final return is exact.
        return out.doc_type

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
