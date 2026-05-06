"""Chandra OCR via the official Datalab Python SDK.

Thin wrapper around `datalab-python-sdk`. The SDK handles auth (env
`DATALAB_API_KEY` or `api_key=` arg), retries, polling, and multipart
upload.

Two principal calls used by the rest of the backend:

  - `convert_with_chunks()`  → high-quality structured output with
    per-block bbox/polygon/block_type. The canonical OCR pass.

  - `ocr_file()`             → line-level OCR with polygons. Lower-tier
    quality (no `mode="accurate"` switch). Kept for low-level debugging
    and the deprecated Docling plugin path.
"""

from __future__ import annotations

from pathlib import Path
from typing import Final

from datalab_sdk import AsyncDatalabClient, DatalabClient
from datalab_sdk.models import ConvertOptions, ConversionResult, OCRResult

from app.config import settings

_API_KEY_ENV_FALLBACK: Final[str] = "CHANDRA_API_KEY"


def _resolve_api_key() -> str:
    """Prefer DATALAB_API_KEY (SDK convention) but fall back to CHANDRA_API_KEY."""
    key = settings.CHANDRA_API_KEY
    if not key:
        raise RuntimeError(
            f"Missing API key. Set DATALAB_API_KEY or {_API_KEY_ENV_FALLBACK}."
        )
    return key


def get_sync_client() -> DatalabClient:
    return DatalabClient(api_key=_resolve_api_key())


def get_async_client() -> AsyncDatalabClient:
    return AsyncDatalabClient(api_key=_resolve_api_key())


# --- Chunks-mode convert (canonical pass) -------------------------------------

_DEFAULT_CONVERT_OPTIONS = dict(
    mode="accurate",
    output_format="chunks",
    add_block_ids=True,
    save_checkpoint=True,
)


def _build_convert_options(**overrides) -> ConvertOptions:
    params = {**_DEFAULT_CONVERT_OPTIONS, **overrides}
    return ConvertOptions(**params)


def convert_with_chunks(path: str | Path, **overrides) -> ConversionResult:
    """One-call structured conversion.

    Returns `ConversionResult` with `.chunks` populated:

        chunks = {
            "blocks": [
                {
                    "id": "/page/0/Text/0",
                    "block_type": "Text" | "Table" | "Picture" | "SectionHeader" | ...,
                    "html": "<p>...</p>",
                    "page": 0,
                    "polygon": [[x,y], [x,y], [x,y], [x,y]],
                    "bbox": [l, t, r, b],
                    "section_hierarchy": {...}
                },
                ...
            ],
            "page_info": {...},
            "metadata": {...},
        }

    Plus `.markdown`, `.page_count`, `.checkpoint_id`, `.cost_breakdown`.

    The checkpoint_id can be reused via `extract_with_schema(checkpoint_id=...)`
    to skip re-running OCR on the same document.
    """
    client = get_sync_client()
    return client.convert(str(path), options=_build_convert_options(**overrides))


async def convert_with_chunks_async(path: str | Path, **overrides) -> ConversionResult:
    async with get_async_client() as client:
        return await client.convert(
            str(path), options=_build_convert_options(**overrides)
        )


def convert_bytes_with_chunks(
    file_bytes: bytes, filename: str, **overrides
) -> ConversionResult:
    """Convenience: write bytes to a temp file, call SDK, return result.

    Useful inside FastAPI routes that receive `UploadFile.read()` bytes
    rather than a path on disk.
    """
    import tempfile

    suffix = Path(filename).suffix or ".pdf"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(file_bytes)
        tmp.flush()
        return convert_with_chunks(tmp.name, **overrides)


async def convert_bytes_with_chunks_async(
    file_bytes: bytes, filename: str, **overrides
) -> ConversionResult:
    import tempfile

    suffix = Path(filename).suffix or ".pdf"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(file_bytes)
        tmp.flush()
        return await convert_with_chunks_async(tmp.name, **overrides)


# --- Line-level OCR (kept for debugging, lower quality) ---------------------


def ocr_file(path: str | Path) -> OCRResult:
    """Run line-level OCR on a single file. Returns the typed `OCRResult`.

    `OCRResult.pages[i].text_lines` carries `polygon` (4-point), `text`,
    `confidence`, and per-`chars` annotations. Note: lower quality than
    `convert_with_chunks(mode="accurate")` on stamped/handwritten regions.
    """
    client = get_sync_client()
    return client.ocr(str(path))


async def ocr_file_async(path: str | Path) -> OCRResult:
    async with get_async_client() as client:
        return await client.ocr(str(path))
