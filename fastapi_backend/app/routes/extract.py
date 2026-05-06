"""Document extraction routes.

POST /extract             — Chandra OCR only (markdown / html / chunks).
POST /extract/structured  — Chandra + multimodal LLM via LiteLLM proxy;
                            returns typed JSON + DoclingDocument IR.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.services.chandra_ocr import convert_bytes_with_chunks_async
from app.services.extraction import DocType, extract_structured

router = APIRouter(tags=["extract"])


class ExtractResponse(BaseModel):
    filename: str
    page_count: int | None
    markdown: str
    html: str | None = None
    chunks: dict[str, Any] | None = None
    checkpoint_id: str | None = None


class StructuredExtractResponse(BaseModel):
    filename: str
    doc_type: Literal["delivery_order", "weighing_bill", "invoice", "petrol_bill"]
    model: str
    page_count: int | None
    extracted: dict[str, Any]
    markdown: str
    docling_doc: dict[str, Any]
    checkpoint_id: str | None = None


@router.post("/extract", response_model=ExtractResponse)
async def extract_document(
    file: Annotated[UploadFile, File(description="PDF or image file")],
) -> ExtractResponse:
    """Run Chandra `convert(mode=accurate, output_format=chunks)` and return raw chunks + markdown.

    The structured `chunks` payload carries per-block bbox/polygon/block_type;
    use it directly when you need the raw OCR layout without typed extraction.
    """
    if file.filename is None:
        raise HTTPException(status_code=400, detail="missing filename")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="empty file")

    try:
        result = await convert_bytes_with_chunks_async(file_bytes, file.filename)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"chandra: {exc}") from exc

    if not result.success:
        raise HTTPException(
            status_code=502, detail=f"chandra: {result.error or 'unknown error'}"
        )

    return ExtractResponse(
        filename=file.filename,
        page_count=result.page_count,
        markdown=result.markdown or "",
        html=result.html,
        chunks=result.chunks if isinstance(result.chunks, dict) else None,
        checkpoint_id=result.checkpoint_id,
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
            description="LiteLLM virtual model name (vision-primary, vision-fallback-1, ...)"
        ),
    ] = "vision-primary",
    dpi: Annotated[int, Form(description="PDF render DPI")] = 150,
) -> StructuredExtractResponse:
    """Chandra (chunks → DoclingDocument) + page images → LLM → typed JSON."""
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
    except RuntimeError as exc:
        # Only RuntimeError raised by extract_structured itself signals
        # Chandra failure (we raise it explicitly). Other exceptions bubble
        # from the LLM agent or the SDK.
        msg = str(exc)
        if msg.startswith("Chandra"):
            raise HTTPException(status_code=502, detail=f"chandra: {exc}") from exc
        raise HTTPException(status_code=502, detail=f"llm: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"llm: {exc}") from exc

    return StructuredExtractResponse(
        filename=file.filename,
        doc_type=result["doc_type"],
        model=result["model"],
        page_count=result["page_count"],
        extracted=result["extracted"],
        markdown=result["markdown"],
        docling_doc=result["docling_doc"],
        checkpoint_id=result["checkpoint_id"],
    )
