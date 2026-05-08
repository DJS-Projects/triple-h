"""Tier-1 + Tier-2 anchor extraction over Chandra `chunks` blocks.

Stage 1 of the two-stage pipeline. Produces `FieldProvenance` records
that pin extraction values to specific OCR blocks before any LLM call.

Tier semantics (highest → lowest confidence):

  Tier 1 — label_proximity
      Block text contains a known field label ("Vehicle No:") within
      a short lookahead of a regex-matching value. Strongest signal.

  Tier 2 — table_header
      Block is a `<table>` with column headers that map to schema
      fields. Cell content regex-validates against the field's
      pattern.  Good for line items + IDs in tabular layouts.

  Tier 3 — shape_only (NOT EMITTED HERE — see note below)
      Pattern hit in body text without a label or header to anchor
      it. Currently we skip emission of these because false-positive
      rate is high (a postcode-shaped 5-digit number could be a
      counter; a plate-shaped string could be a part code). When the
      LLM call is added, free hits will be passed as low-confidence
      candidates the model can accept or reject — they don't need
      to flow through this module.

The `extract_anchors` entrypoint runs both passes and returns a flat
list. The pipeline merge layer is responsible for deduplicating when
the same field is anchored multiple times (typical: label + table both
hit the same value).
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from datetime import date
from typing import Any, Final

from bs4 import BeautifulSoup, Tag

from app.services.extraction.preprocess import correct_id_chars
from app.services.extraction.result import FieldProvenance
from app.services.extraction.validators import (
    DATE_HINT,
    PLATE_PENINSULAR,
    PLATE_SABAH,
    PLATE_SARAWAK,
    POSTCODE,
    TIN_ANY,
    normalize_plate,
)

# ─── Field → label hint phrases ──────────────────────────────────────────────
#
# Each entry is a list of regex fragments (case-insensitive) that
# typically precede a value of this field type in printed forms. Keep
# fragments short and literal — anchors are about precision, not recall.

_LABEL_HINTS: Final[dict[str, list[str]]] = {
    "vehicle_number": [
        r"vehicle\s*(?:no|number|plate)",
        r"lori",  # MY truck
        r"plate\s*no",
        r"reg(?:istration)?\s*(?:no|number)",
    ],
    "do_number": [
        r"d\s*[./]?\s*o\s*(?:no|number)",
        r"delivery\s*order\s*(?:no|number)",
    ],
    "po_number": [
        r"p\s*[./]?\s*o\s*(?:no|number)",
        r"purchase\s*order\s*(?:no|number)",
    ],
    "weighing_no": [
        r"weighing\s*(?:no|number|ticket|slip)",
        r"timbang",  # MY weighing
    ],
    "contract_no": [
        r"contract\s*(?:no|number)",
    ],
    "invoice_number": [
        r"invoice\s*(?:no|number)",
        r"\binv\s*no",
    ],
    "tin": [
        r"\btin\b",
        r"tax\s*id(?:entification)?\s*(?:no|number)?",
        r"no\s*cukai",
    ],
    "postcode": [
        r"\bposkod\b",
        r"\bpostcode\b",
        r"\bpostal\s*code\b",
    ],
    "date": [
        r"\bdate\b",
        r"\btarikh\b",  # MY date
        r"\bissued\b",
    ],
}

# Compiled lookup: field → regex matching any of its label hints.
_LABEL_RE: Final[dict[str, re.Pattern[str]]] = {
    field: re.compile("|".join(f"(?:{p})" for p in patterns), re.IGNORECASE)
    for field, patterns in _LABEL_HINTS.items()
}


# ─── Field → value-shape regex ───────────────────────────────────────────────
#
# Used only after a label match has placed us in the right region.
# `vehicle_number` accepts any of the regional plate variants. ID-code
# fields (do_number, po_number, weighing_no, contract_no) are
# customer-internal — we don't know their shape from public sources, so
# we accept any reasonably-long alphanumeric token within the label
# window and let the LLM verify. This is intentional: false positives
# from over-eager regex are worse than handing a candidate to the
# verifier.

_ID_TOKEN: Final = re.compile(r"[A-Z0-9][A-Z0-9./-]{2,}", re.IGNORECASE)

_FIELD_VALUE_PATTERNS: Final[dict[str, re.Pattern[str]]] = {
    "vehicle_number": re.compile(
        # Accept any of the regional plate prefixes; full validation
        # happens via `is_valid_plate` below. The trailing
        # `(?:\s+[A-Z](?=$|[^\w]))?` captures Sarawak/Sabah suffix
        # letters ("QAB 2397 L") only when the letter is terminal —
        # otherwise we'd grab the first letter of the next word
        # ("JWP 8186 Material" → "JWP 8186 M").
        r"[A-Z]{1,3}\s?\d{1,4}[A-Z]?(?:\s+[A-Z](?=$|[^A-Za-z]))?",
        re.IGNORECASE,
    ),
    "tin": TIN_ANY,
    "postcode": POSTCODE,
    "date": DATE_HINT,
    # ID fields: any alphanumeric run of length ≥ 3 within label window.
    "do_number": _ID_TOKEN,
    "po_number": _ID_TOKEN,
    "weighing_no": _ID_TOKEN,
    "contract_no": _ID_TOKEN,
    "invoice_number": _ID_TOKEN,
}


def _is_plate_validated(value: str) -> bool:
    """Validate a vehicle plate candidate against documented regional patterns."""
    canonical = normalize_plate(value)
    return any(
        p.match(canonical) for p in (PLATE_PENINSULAR, PLATE_SARAWAK, PLATE_SABAH)
    )


# ─── Field → table column header phrases ─────────────────────────────────────
#
# Used by Tier 2: when a Chandra block is a `<table>`, we map its `<th>`
# headers (lowercased, trimmed) to schema fields by phrase membership.
# Match is "any header substring contains any of these phrases" — keeps
# the rule loose enough for "Veh. No." to map to vehicle_number while
# tight enough that "Vendor" doesn't.

_HEADER_HINTS: Final[dict[str, list[str]]] = {
    "vehicle_number": ["vehicle", "lori", "plate"],
    "do_number": ["d/o", "do no", "delivery order"],
    "po_number": ["p/o", "po no", "purchase order"],
    "weighing_no": ["weighing", "timbang"],
    "contract_no": ["contract"],
    "gross_weight": ["gross"],
    "tare_weight": ["tare"],
    "net_weight": ["net"],
    "off_weight": ["off"],
    "actual_weight": ["actual"],
    # Item-table columns: described separately because they emit nested rows
    "items.description": ["description", "material", "item", "product", "good"],
    "items.quantity": ["quantity", "qty"],
    "items.unit_price": ["unit price", "price"],
    "items.amount": ["amount", "total"],
    "items.weight_mt": ["weight", "mt"],
}


# ─── Public entrypoint ───────────────────────────────────────────────────────


def extract_anchors(
    blocks: Iterable[dict[str, Any]],
    *,
    doc_date: date | None = None,
) -> list[FieldProvenance]:
    """Run Tier-1 + Tier-2 anchor passes over a sequence of Chandra blocks.

    `blocks` is the `chunks["blocks"]` list emitted by Chandra:

        {
            "id": "/page/0/Text/3",
            "block_type": "Text" | "Table" | "SectionHeader" | "Picture" | ...,
            "html": "<p>...</p>" | "<table>...</table>",
            "bbox": [l, t, r, b],
            "page": 0,
        }

    `doc_date` is the parsed document date used to anchor character
    correction (S↔5, l↔1, etc) on extracted ID-code candidates. When
    None, char correction is skipped.

    Returns one `FieldProvenance` per anchored value. Caller must
    deduplicate when the same field is anchored multiple times by
    label and table — keep the higher-confidence source (table
    headers usually beat label proximity in tabular layouts).
    """
    out: list[FieldProvenance] = []
    for block in blocks:
        block_type = block.get("block_type", "")
        if block_type == "Picture":
            continue
        if block_type == "Table":
            out.extend(_scan_table_block(block, doc_date=doc_date))
        out.extend(_scan_label_block(block, doc_date=doc_date))
    return out


# ─── Tier 1: label-proximity scan ────────────────────────────────────────────


# How far past a label we still consider the value to be "this label's value".
# 80 chars is enough for "Weighing No.: 202301011234" plus surrounding
# punctuation but tight enough that the next field's label doesn't bleed in.
_LABEL_LOOKAHEAD: Final = 80


def _scan_label_block(
    block: dict[str, Any], *, doc_date: date | None
) -> list[FieldProvenance]:
    """Tier 1: label-proximity scan within a single block's text content."""
    text = _strip_html(block.get("html", ""))
    if not text:
        return []

    block_id = block.get("id")
    bbox = _bbox(block)
    page = _page(block)
    out: list[FieldProvenance] = []

    for field, label_re in _LABEL_RE.items():
        for label_match in label_re.finditer(text):
            start = label_match.end()
            window = text[start : start + _LABEL_LOOKAHEAD]
            value = _extract_value(field, window, doc_date=doc_date)
            if value is None:
                continue
            out.append(
                FieldProvenance(
                    field=field,
                    value=value,
                    source="regex_label",
                    block_id=block_id,
                    bbox=bbox,
                    page=page,
                    confidence=1.0,
                )
            )
    return out


def _extract_value(field: str, window: str, *, doc_date: date | None) -> str | None:
    """Apply field-specific value regex within a label-anchored window.

    For ID-code fields, the matched candidate gets char-corrected
    against `doc_date` before being returned. For plates, the
    candidate is validated against the regional plate patterns; an
    unvalidated candidate is dropped (we'd rather have no anchor than
    a wrong one).
    """
    pat = _FIELD_VALUE_PATTERNS.get(field)
    if pat is None:
        return None
    m = pat.search(window)
    if m is None:
        return None
    raw = m.group(0).strip()

    if field == "vehicle_number":
        canonical = normalize_plate(raw)
        return canonical if _is_plate_validated(canonical) else None

    if field in {
        "do_number",
        "po_number",
        "weighing_no",
        "contract_no",
        "invoice_number",
    }:
        return correct_id_chars(raw.upper(), doc_date)

    return raw


# ─── Tier 2: table column-header scan ────────────────────────────────────────


def _scan_table_block(
    block: dict[str, Any], *, doc_date: date | None
) -> list[FieldProvenance]:
    """Tier 2: per-cell scan inside a `<table>` block keyed off `<th>` text."""
    html = block.get("html", "")
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")
    block_id = block.get("id")
    bbox = _bbox(block)
    page = _page(block)
    out: list[FieldProvenance] = []

    for table in soup.find_all("table"):
        if not isinstance(table, Tag):
            continue
        header_to_field = _map_headers_to_fields(table)
        if not header_to_field:
            continue

        for row in table.find_all("tr"):
            if not isinstance(row, Tag):
                continue
            cells = [c for c in row.find_all("td") if isinstance(c, Tag)]
            if not cells:
                continue
            for col_idx, cell in enumerate(cells):
                field = header_to_field.get(col_idx)
                if field is None:
                    continue
                cell_text = cell.get_text(strip=True)
                if not cell_text:
                    continue
                value = _value_from_cell(field, cell_text, doc_date=doc_date)
                if value is None:
                    continue
                out.append(
                    FieldProvenance(
                        field=field,
                        value=value,
                        source="regex_table",
                        block_id=block_id,
                        bbox=bbox,
                        page=page,
                        confidence=1.0,
                    )
                )
    return out


def _map_headers_to_fields(table: Tag) -> dict[int, str]:
    """Build a column-index → field-key map by matching header text."""
    headers = [
        th.get_text(strip=True).lower()
        for th in table.find_all("th")
        if isinstance(th, Tag)
    ]
    if not headers:
        # Some Chandra HTML uses <td> in the first row instead of <th>.
        first_row = table.find("tr")
        if isinstance(first_row, Tag):
            headers = [
                td.get_text(strip=True).lower()
                for td in first_row.find_all("td")
                if isinstance(td, Tag)
            ]

    out: dict[int, str] = {}
    for idx, header_text in enumerate(headers):
        for field, hints in _HEADER_HINTS.items():
            if any(hint in header_text for hint in hints):
                out[idx] = field
                break
    return out


def _value_from_cell(
    field: str, cell_text: str, *, doc_date: date | None
) -> str | None:
    """Validate and normalize a cell's value for the mapped field.

    Some fields (weights, items.*) accept the cell text as-is — the
    postprocess layer handles formatting (4-dp, tonne suffix). ID
    fields get char-corrected. Plates are validated against regional
    patterns and rejected if invalid.
    """
    if field == "vehicle_number":
        canonical = normalize_plate(cell_text)
        return canonical if _is_plate_validated(canonical) else None

    if field in {
        "do_number",
        "po_number",
        "weighing_no",
        "contract_no",
        "invoice_number",
    }:
        return correct_id_chars(cell_text.upper(), doc_date)

    # Weights and item-row columns: accept cell text as-is. Postprocess
    # layer (weights.py, dates.py) will normalize formatting.
    return cell_text


# ─── Block-shape helpers ─────────────────────────────────────────────────────


def _strip_html(html: str) -> str:
    """Convert block HTML to plain text for label-proximity scanning."""
    if not html:
        return ""
    return BeautifulSoup(html, "lxml").get_text(separator=" ", strip=True)


def _bbox(block: dict[str, Any]) -> tuple[float, float, float, float] | None:
    raw = block.get("bbox")
    if not isinstance(raw, (list, tuple)) or len(raw) != 4:
        return None
    try:
        return (float(raw[0]), float(raw[1]), float(raw[2]), float(raw[3]))
    except (TypeError, ValueError):
        return None


def _page(block: dict[str, Any]) -> int | None:
    """Return 1-indexed page number from the block's `page` field.

    Chandra emits 0-indexed pages; the rest of our pipeline (rendered
    page PNGs, review UI bbox overlays) uses 1-indexed. Convert here so
    `FieldProvenance.page` is consistent.
    """
    raw = block.get("page")
    if isinstance(raw, int):
        return raw + 1
    return None
