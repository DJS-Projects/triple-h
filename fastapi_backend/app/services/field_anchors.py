"""Map extracted JSON fields → Chandra block IDs (best-effort, post-hoc).

The LLM emits typed scalars like `do_number: "DO-61581"` without any
provenance. Until we move provenance into the schema itself (each field
emitted as `{value, source_block_id}`), we backfill the link here by
string-matching the extracted value into the OCR'd block text. That
gets the review UI to "hover row → highlight box on page" with no
schema or prompt change.

Match strategy is intentionally dumb:
  - normalise both sides (lowercase, strip punctuation/whitespace)
  - direct substring containment in either direction
  - shortest matching block wins (tighter anchors)
  - first hit wins ties

This is a v1 heuristic — it'll miss when the same number appears in
multiple blocks (e.g. an order number that's also a serial somewhere
else) and on values the LLM rephrased. The right fix is structured
provenance from the LLM; this gets us to interactive overlay today.
"""

from __future__ import annotations

import re
from typing import Any

_NORMALISE_RE = re.compile(r"[^a-z0-9]+")


def _norm(s: str) -> str:
    return _NORMALISE_RE.sub("", s.lower()).strip()


def _flatten_scalars(
    obj: Any,
    prefix: str = "",
    out: dict[str, str] | None = None,
) -> dict[str, str]:
    """Walk an extracted dict, emitting `{path: stringified_value}` for scalars.

    Lists of objects (line-item tables) get walked with `[i]` indices so
    each cell can independently anchor to a block.
    """
    if out is None:
        out = {}
    if obj is None:
        return out
    if isinstance(obj, (str, int, float, bool)):
        out[prefix] = str(obj)
        return out
    if isinstance(obj, list):
        for i, v in enumerate(obj):
            _flatten_scalars(v, f"{prefix}[{i}]", out)
        return out
    if isinstance(obj, dict):
        for k, v in obj.items():
            next_path = f"{prefix}.{k}" if prefix else k
            _flatten_scalars(v, next_path, out)
        return out
    return out


_HTML_TAG_RE = re.compile(r"<[^>]+>")
_BLOCK_ID_PAGE_RE = re.compile(r"^/page/(\d+)/")


def page_no_for_block_id(block_id: str) -> int | None:
    """Parse 1-indexed page number out of a Chandra block id (`/page/N/...`).

    Chandra block IDs encode the page directly; this is cheaper and more
    reliable than re-walking the chunks to look up a block by id.
    """
    m = _BLOCK_ID_PAGE_RE.match(block_id)
    return int(m.group(1)) + 1 if m else None


def _block_text(block: dict[str, Any]) -> str:
    raw = block.get("html") or block.get("markdown") or ""
    if not raw:
        return ""
    text = _HTML_TAG_RE.sub(" ", raw)
    return text


def compute_field_anchors(
    extracted: dict[str, Any],
    chandra_chunks: dict[str, Any],
    *,
    page_no: int | None = None,
) -> dict[str, str]:
    """Return `{field_path: block_id}` for every scalar leaf with a match.

    `page_no` is 1-indexed (matching `DocumentPage.page_no`); pass None
    to anchor across every page in the document.
    """
    blocks = chandra_chunks.get("blocks") or []
    if page_no is not None:
        target = page_no - 1
        blocks = [b for b in blocks if int(b.get("page", -1)) == target]

    indexed: list[tuple[str, str, str]] = []
    for b in blocks:
        bid = b.get("id")
        if not bid:
            continue
        text = _block_text(b)
        if not text:
            continue
        indexed.append((str(bid), text, _norm(text)))

    fields = _flatten_scalars(extracted)
    anchors: dict[str, str] = {}
    for path, raw_value in fields.items():
        needle = _norm(raw_value)
        if len(needle) < 2:  # noise-prone; skip "1", empty, etc.
            continue
        candidates: list[tuple[int, str]] = []
        for bid, _text, norm_text in indexed:
            if not norm_text:
                continue
            # Either side containment — the LLM may emit a slice of a
            # block ("Klang") or a paraphrased aggregate ("Klang, Selangor").
            if needle in norm_text or norm_text in needle:
                candidates.append((len(norm_text), bid))
        if not candidates:
            continue
        # Tightest block wins — shorter text means a more specific anchor.
        candidates.sort(key=lambda c: c[0])
        anchors[path] = candidates[0][1]

    return anchors


def compute_field_pages(
    extracted: dict[str, Any],
    chandra_chunks: dict[str, Any],
) -> dict[str, int]:
    """Return `{field_path: page_no_1indexed}` for every anchored scalar.

    Computes anchors across all pages (no filter), then projects each
    anchor's block_id to its source page. Fields with no anchor are
    omitted from the result — the FE treats those as document-level.
    """
    anchors = compute_field_anchors(extracted, chandra_chunks)
    out: dict[str, int] = {}
    for path, bid in anchors.items():
        page = page_no_for_block_id(bid)
        if page is not None:
            out[path] = page
    return out
