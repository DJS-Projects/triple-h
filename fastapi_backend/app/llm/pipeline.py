from pathlib import Path
from typing import TYPE_CHECKING

from pydantic_ai import Agent

from .client import get_model

if TYPE_CHECKING:
    from pydantic import BaseModel


class FastPipeline:
    """Docling parse → Pydantic AI extraction.

    Skeleton only. Full implementation (doc-type detection, prompt routing,
    eval-harness wiring) lands next session.
    """

    def __init__(
        self,
        provider: str = "nim",
        model: str = "llama-3.3-70b",
    ) -> None:
        self.model = get_model(provider, model)
        self._converter = None

    def _ensure_converter(self):
        if self._converter is None:
            from docling.document_converter import DocumentConverter

            self._converter = DocumentConverter()
        return self._converter

    async def extract(
        self,
        pdf_path: Path,
        output_type: type["BaseModel"],
        prompt_template: str,
    ) -> "BaseModel":
        converter = self._ensure_converter()
        result = converter.convert(str(pdf_path))
        markdown = result.document.export_to_markdown()
        agent = Agent(self.model, output_type=output_type)
        run = await agent.run(prompt_template.format(context=markdown))
        return run.output
