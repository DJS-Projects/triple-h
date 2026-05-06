"""Document extraction routes.

POST /extract             — Chandra OCR only, returns markdown.
POST /extract/structured  — Chandra + multimodal LLM via LiteLLM proxy,
                            returns typed JSON for the requested doc type.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.services.chandra import ChandraAPIError, convert_document
from app.services.extraction import DocType, extract_structured

router = APIRouter(tags=["extract"])


class ExtractResponse(BaseModel):
    filename: str
    page_count: int | None
    markdown: str
    html: str | None = None
    json_data: dict[str, Any] | None = None


class StructuredExtractResponse(BaseModel):
    filename: str
    doc_type: Literal["delivery_order", "weighing_bill", "invoice", "petrol_bill"]
    model: str
    page_count: int | None
    extracted: dict[str, Any]
    markdown: str


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


@router.post("/extract/structured", response_model=StructuredExtractResponse)
async def extract_document_structured(
    file: Annotated[UploadFile, File(description="PDF or image file")],
    doc_type: Annotated[
        DocType,
        Form(description="delivery_order | weighing_bill | invoice | petrol_bill"),
    ] = "delivery_order",
    model: Annotated[
        str,
        Form(
            description="LiteLLM virtual model name (vision-primary, vision-fallback-1, etc.)"
        ),
    ] = "vision-primary",
    dpi: Annotated[int, Form(description="PDF render DPI")] = 150,
) -> StructuredExtractResponse:
    """Multimodal extraction: Chandra OCR + page images → LLM via LiteLLM → typed JSON."""
    if file.filename is None:
        raise HTTPException(status_code=400, detail="missing filename")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="empty file")

    try:
        result = await extract_structured(
            file_bytes,
            file.filename,
            doc_type=doc_type,
            model=model,
            dpi=dpi,
        )
    except ChandraAPIError as exc:
        raise HTTPException(status_code=502, detail=f"chandra: {exc}") from exc
    except Exception as exc:  # LiteLLM/agent failures
        raise HTTPException(status_code=502, detail=f"llm: {exc}") from exc

    return StructuredExtractResponse(
        filename=file.filename,
        doc_type=result["doc_type"],
        model=result["model"],
        page_count=result["page_count"],
        extracted=result["extracted"],
        markdown=result["markdown"],
    )
