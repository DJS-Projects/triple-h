"""Refinement routes — VLM-driven OCR scaffold cleanup.

POST /refine/{extraction_run_id}
    Run one refinement pass over the most relevant page of the
    extraction's DoclingDocument scaffold. Persists a new
    `refinement_run` row, demotes the prior `is_current` row, and
    returns the patched scaffold + ARQ trace.

Phase 1 scope: classification only — `assign` + `reject` patches.
Geometry-edit ops (`add`, `move`) deferred until Phase 2/3.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.models import User
from app.refinement.pipeline import refine_scaffold
from app.refinement.schemas import RefinementResult
from app.services import persistence
from app.services.blob_store import BlobStore, get_blob_store
from app.users import current_active_user

router = APIRouter(tags=["refine"])


class RefineResponse(BaseModel):
    refinement_run_id: int
    extraction_run_id: int
    vlm_model: str
    prompt_version: str
    duration_ms: int
    token_usage: dict[str, Any] | None
    result: RefinementResult
    scaffold_out: dict[str, Any]


def _blob_store() -> BlobStore:
    return get_blob_store()


@router.post("/refine/{extraction_run_id}", response_model=RefineResponse)
async def refine_extraction(
    extraction_run_id: int,
    page_no: Annotated[
        int,
        Query(ge=1, description="Page number to refine (1-indexed). Default 1."),
    ] = 1,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
    blob_store: BlobStore = Depends(_blob_store),
) -> RefineResponse:
    extraction_run = await persistence.get_extraction_run(session, extraction_run_id)
    if extraction_run is None:
        raise HTTPException(status_code=404, detail="extraction_run not found")

    payload = extraction_run.payload or {}
    scaffold = payload.get("docling_doc")
    extracted = payload.get("extracted") or {}
    if not isinstance(scaffold, dict):
        raise HTTPException(
            status_code=409,
            detail="extraction_run.payload.docling_doc missing or malformed",
        )

    page = await persistence.get_page(session, extraction_run.document_id, page_no)
    if page is None:
        raise HTTPException(
            status_code=404, detail=f"page {page_no} not found for document"
        )

    try:
        page_bytes = await blob_store.get(page.blob_key)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"blob_store: {exc}") from exc

    field_keys = _flatten_field_keys(extracted)
    if not field_keys:
        raise HTTPException(
            status_code=409,
            detail="extraction_run has no extracted field keys to refine",
        )

    try:
        outcome = refine_scaffold(
            page_image_bytes=page_bytes,
            docling_scaffold=scaffold,
            field_keys=field_keys,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"vlm: {exc}") from exc

    run = await persistence.record_refinement_run(
        session,
        extraction_run_id=extraction_run_id,
        vlm_model=outcome.vlm_model,
        prompt_version=outcome.prompt_version,
        scaffold_in=outcome.scaffold_in,
        scaffold_out=outcome.scaffold_out,
        patches=[p.model_dump() for p in outcome.result.patches],
        arq_trace=outcome.result.arq_trace.model_dump(),
        token_usage=outcome.token_usage,
        duration_ms=outcome.duration_ms,
    )
    await session.commit()

    return RefineResponse(
        refinement_run_id=run.refinement_run_id,
        extraction_run_id=extraction_run_id,
        vlm_model=outcome.vlm_model,
        prompt_version=outcome.prompt_version,
        duration_ms=outcome.duration_ms,
        token_usage=outcome.token_usage,
        result=outcome.result,
        scaffold_out=outcome.scaffold_out,
    )


def _flatten_field_keys(value: Any, prefix: str = "") -> list[str]:
    """Flatten the extraction's `extracted` payload into dot/bracket keys.

    Mirrors the frontend KVP table shape: nested dicts use dot, list
    items use bracket index. Skips keys whose value is None.
    """
    out: list[str] = []
    if isinstance(value, dict):
        for k, v in value.items():
            child = f"{prefix}.{k}" if prefix else k
            out.extend(_flatten_field_keys(v, child))
    elif isinstance(value, list):
        for i, v in enumerate(value):
            child = f"{prefix}[{i}]"
            out.extend(_flatten_field_keys(v, child))
    elif value is not None:
        out.append(prefix)
    return out
