"""Datalab.to Chandra OCR API client.

Async pipeline: submit PDF/image → poll request_check_url → return markdown/HTML/JSON.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings


class ChandraAPIError(RuntimeError):
    pass


@dataclass(frozen=True)
class ChandraResult:
    markdown: str
    html: str | None
    json_data: dict[str, Any] | None
    page_count: int | None
    raw: dict[str, Any]


_DEFAULT_POLL_INTERVAL_SEC = 2.0
_DEFAULT_TIMEOUT_SEC = 180.0


async def convert_document(
    file_bytes: bytes,
    filename: str,
    *,
    output_format: str = "markdown",
    langs: str | None = None,
    use_llm: bool = False,
    poll_interval: float = _DEFAULT_POLL_INTERVAL_SEC,
    timeout: float = _DEFAULT_TIMEOUT_SEC,
) -> ChandraResult:
    """Submit a document to /convert, poll until complete, return parsed result.

    Args:
        file_bytes: Raw bytes of the document (PDF, image, etc.)
        filename: Original filename (used by API for content-type detection)
        output_format: "markdown" (default), "html", "json", or "chunks"
        langs: Optional comma-separated language hints (e.g. "English,Malay")
        use_llm: Enable LLM post-processing (more accurate, slower, costs more)
        poll_interval: Seconds between status checks
        timeout: Total seconds before giving up

    Raises:
        ChandraAPIError: on HTTP error, API failure, or timeout.
    """
    if not settings.CHANDRA_API_KEY:
        raise ChandraAPIError("CHANDRA_API_KEY not configured")

    headers = {"X-API-Key": settings.CHANDRA_API_KEY}
    submit_url = f"{settings.CHANDRA_API_BASE_URL}/convert"

    files = {"file": (filename, file_bytes, "application/pdf")}
    data: dict[str, Any] = {"output_format": output_format}
    if langs:
        data["langs"] = langs
    if use_llm:
        data["use_llm"] = "true"

    async with httpx.AsyncClient(timeout=30.0) as client:
        submit_resp = await client.post(
            submit_url, headers=headers, files=files, data=data
        )
        if submit_resp.status_code >= 400:
            raise ChandraAPIError(
                f"submit failed [{submit_resp.status_code}]: {submit_resp.text}"
            )
        submit_json = submit_resp.json()
        if not submit_json.get("success"):
            raise ChandraAPIError(f"submit rejected: {submit_json}")

        check_url = submit_json["request_check_url"]
        request_id = submit_json.get("request_id", "?")

        deadline = asyncio.get_event_loop().time() + timeout
        while True:
            if asyncio.get_event_loop().time() > deadline:
                raise ChandraAPIError(
                    f"timeout after {timeout}s waiting on request {request_id}"
                )

            await asyncio.sleep(poll_interval)
            poll_resp = await client.get(check_url, headers=headers)
            if poll_resp.status_code >= 400:
                raise ChandraAPIError(
                    f"poll failed [{poll_resp.status_code}]: {poll_resp.text}"
                )
            poll_json = poll_resp.json()
            status = poll_json.get("status")

            if status == "complete":
                return ChandraResult(
                    markdown=poll_json.get("markdown", ""),
                    html=poll_json.get("html"),
                    json_data=poll_json.get("json"),
                    page_count=poll_json.get("page_count"),
                    raw=poll_json,
                )
            if status == "error" or poll_json.get("success") is False:
                err = poll_json.get("error", "unknown error")
                raise ChandraAPIError(f"request {request_id} failed: {err}")
            # status == "processing" or similar → keep polling
