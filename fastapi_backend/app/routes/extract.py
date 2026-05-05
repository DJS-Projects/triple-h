"""Document extraction routes.

POST /extract — upload a PDF/image, get back markdown via Chandra OCR.
Future: structured JSON output via Pydantic AI agent layer.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.services.chandra import ChandraAPIError, convert_document

router = APIRouter(tags=["extract"])


class ExtractResponse(BaseModel):
    filename: str
    page_count: int | None
    markdown: str
    html: str | None = None
    json_data: dict[str, Any] | None = None


@router.post("/extract", response_model=ExtractResponse)
async def extract_document(
    file: Annotated[UploadFile, File(description="PDF or image file")],
    output_format: Annotated[str, Form()] = "markdown",
    use_llm: Annotated[bool, Form()] = False,
    langs: Annotated[str | None, Form()] = None,
) -> ExtractResponse:
    """Submit a document to Chandra OCR via datalab.to and return parsed output.

    output_format: "markdown" (default), "html", "json", or "chunks"
    use_llm: Enable LLM post-processing (slower, more accurate, more expensive)
    langs: Comma-separated language hints (e.g. "English,Malay")
    """
    if file.filename is None:
        raise HTTPException(status_code=400, detail="missing filename")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="empty file")

    try:
        result = await convert_document(
            file_bytes,
            file.filename,
            output_format=output_format,
            use_llm=use_llm,
            langs=langs,
        )
    except ChandraAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return ExtractResponse(
        filename=file.filename,
        page_count=result.page_count,
        markdown=result.markdown,
        html=result.html,
        json_data=result.json_data,
    )
