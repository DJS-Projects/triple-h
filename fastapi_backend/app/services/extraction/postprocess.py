"""Deterministic postprocessing of LLM-extracted fields.

Counterpart to `preprocess.py`. Where preprocess fixes OCR text BEFORE
the LLM sees it, postprocess fixes the LLM's output AFTER extraction
to enforce schema-level invariants the LLM is unreliable at:

  - Numeric precision: weights formatted to exactly 4 decimal places.
    LLMs trim trailing zeros ("12.5" not "12.5000") and the reference
    repo's prompt template spends ~6 lines insisting otherwise.
  - Date format: ISO `YYYY-MM-DD`. LLMs echo the input format
    ("25/11/2025" stays as "25/11/2025") unless explicitly told.
  - Company canonicalization: free-form OCR-mangled company names
    fuzzy-matched against a registry of known issuers. Replaces the
    "name list with similarity matching" rule from the prompt.

These rules used to live in the prompt template (~30 lines per
doc-type). Pulling them into Python costs nothing at inference time
(deterministic) and gains testability + auditability.

Boundary contract:
  - Input: a `parsed_info` dict produced by an LLM call (any shape,
    typically the schema-coerced dict from a `*ARQ.extracted` field).
  - Output: a NEW dict with the same shape, normalized values.
  - Never mutates the input. Never deletes keys. When normalization
    fails (unparseable weight, garbage date), the original value is
    preserved so the review UI can flag it for human attention.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from typing import Any, Final

from dateutil import parser as date_parser
from rapidfuzz import fuzz, process

# ─── Weight 4dp normalization ────────────────────────────────────────────────

# Numeric prefix: optional sign, digits + optional thousands separators,
# optional decimal part. Captures the unit (anything trailing) verbatim
# so "MT" / "t" / "kg" / "Tonnes" all survive.
_WEIGHT_RE: Final = re.compile(r"^\s*([+-]?[\d,]+(?:\.\d+)?)\s*(.*?)\s*$")


def normalize_weight_4dp(value: str) -> str | None:
    """Format a weight string with exactly 4 decimal places.

    Preserves the unit suffix verbatim (no whitespace normalization
    inside the unit). Strips thousands separators before parsing.
    Returns `None` when the leading numeric token can't be parsed —
    callers preserve the original value in that case.
    """
    if not value:
        return None
    m = _WEIGHT_RE.match(value)
    if not m:
        return None
    numeric_raw, unit = m.group(1), m.group(2)
    numeric_clean = numeric_raw.replace(",", "")
    try:
        as_float = float(numeric_clean)
    except ValueError:
        return None
    formatted = f"{as_float:.4f}"
    if not unit:
        return formatted
    # If the original had a space between numeric and unit, preserve one.
    # If it was glued ("42.40t"), keep it glued. Detect by re-matching the
    # boundary in the original string.
    boundary_glued = bool(
        re.search(rf"{re.escape(numeric_raw)}{re.escape(unit[0])}", value)
    )
    sep = "" if boundary_glued else " "
    return f"{formatted}{sep}{unit}"


def _parse_numeric_weight(value: str) -> float | None:
    """Extract the numeric part of a weight string for aggregation.

    Returns the float value or None when the value can't be parsed.
    Unlike `normalize_weight_4dp` this returns a number, not a string.
    """
    m = _WEIGHT_RE.match(value)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


# ─── Date ISO normalization ──────────────────────────────────────────────────


def normalize_date_iso(value: str) -> str | None:
    """Parse a date string with `dayfirst=True` and return ISO `YYYY-MM-DD`.

    Malaysia uses DD/MM/YYYY by convention so dayfirst is the safer
    default. Returns `None` when parsing fails (empty input, free text,
    out-of-range components like 32/13/2025).
    """
    if not value or not value.strip():
        return None
    try:
        parsed = date_parser.parse(value, dayfirst=True, fuzzy=False)
    except (ValueError, OverflowError):
        return None
    return parsed.date().isoformat()


# ─── Plate whitespace normalization ─────────────────────────────────────────


def normalize_plate(value: str) -> str:
    """Remove all whitespace from a license plate string.

    Malaysian plates use a standard format (e.g. "JWP 8186") that the LLM
    occasionally reproduces with variable spacing ("JWP8186", "JWP  8186").
    Downstream consumers expect no spaces, so strip them all.
    """
    return "".join(value.split())


# ─── Company canonicalization ────────────────────────────────────────────────

# Strip everything that isn't a letter or digit, lowercase the rest. The
# OCR failure mode we want to absorb is "GBIMESH&BARTRADING SDN.BHD."
# vs "GBI Mesh & Bar Trading Sdn. Bhd." — different spacing,
# punctuation, and case but the same canonical letters in the same
# order. After this processor both reduce to "gbimeshbartradingsdnbhd"
# and score 100 on any token-aware ratio.
_COMPANY_NORM_RE: Final = re.compile(r"[^a-z0-9]+")


def _company_processor(s: str) -> str:
    """Reduce a company name to its alphanumeric skeleton for fuzzy match."""
    return _COMPANY_NORM_RE.sub("", s.lower())


def canonicalize_company(
    name: str,
    registry: Sequence[str],
    threshold: int = 85,
) -> tuple[str | None, int]:
    """Return the best fuzzy match in `registry` if its score crosses `threshold`.

    Both query and registry entries are reduced to their alphanumeric
    skeletons before scoring (lowercase, drop punctuation/whitespace) —
    this absorbs the typical OCR failure modes (joined tokens, dropped
    punctuation, case shifts). `fuzz.ratio` on the skeletons is more
    discriminating than `WRatio` on the raw strings because the
    skeleton already eliminates the variations WRatio's heuristics
    would otherwise have to tolerate.

    Returns `(canonical, score)` on a match, or
    `(None, score_of_best_candidate)` when nothing crosses the threshold
    (so callers can log near-misses without a second pass).

    Empty input or empty registry → `(None, 0)`.
    """
    if not name or not registry:
        return (None, 0)
    best = process.extractOne(
        name, registry, scorer=fuzz.ratio, processor=_company_processor
    )
    if best is None:
        return (None, 0)
    candidate, score, _index = best
    rounded = int(round(score))
    if rounded >= threshold:
        return (candidate, rounded)
    return (None, rounded)


# ─── Per-doc-type field rules ────────────────────────────────────────────────

# Field-type registry. Keep doc-type rules declarative so adding a new
# doc-type (or moving a field between rule classes) doesn't require
# touching the dispatcher logic.
_WEIGHT_FIELDS: Final[dict[str, frozenset[str]]] = {
    "delivery_order": frozenset({"total_weight_mt"}),
    "weighing_bill": frozenset(
        {"gross_weight", "tare_weight", "net_weight", "off_weight", "actual_weight"}
    ),
}

_DATE_FIELDS: Final[dict[str, frozenset[str]]] = {
    "invoice": frozenset({"invoice_date"}),
    "petrol_bill": frozenset({"purchase_datetime"}),
}

_DATE_LIST_FIELDS: Final[dict[str, frozenset[str]]] = {
    "delivery_order": frozenset({"date"}),
}

_PLATE_FIELDS: Final[dict[str, frozenset[str]]] = {
    "delivery_order": frozenset({"vehicle_number"}),
    "weighing_bill": frozenset({"vehicle_no"}),
    "petrol_bill": frozenset({"plate_number"}),
}

_COMPANY_FIELDS: Final[dict[str, frozenset[str]]] = {
    "delivery_order": frozenset({"do_issuer_name", "sold_to", "delivered_to"}),
    "invoice": frozenset({"bill_to", "from_company"}),
}

# Item-list fields with their inner-key rules (currently weight-only).
_ITEM_LIST_RULES: Final[dict[str, dict[str, str]]] = {
    "delivery_order": {"items": "weight_mt"},
}

# Aggregate totals that can be computed from line items when the LLM misses them.
# Key: doc_type → { aggregate_field: item_inner_field }.
_AGGREGATE_RULES: Final[dict[str, dict[str, str]]] = {
    "delivery_order": {
        "total_weight_mt": "weight_mt",
        "total_quantity": "quantity",
    },
}


def _apply_or_keep(value: Any, transform: Any) -> Any:
    """Run `transform` on `value`; preserve original on None/empty/failure.

    Centralizes the "never delete content" contract: if a transform
    returns `None` (parse failure) the input passes through unchanged.
    """
    if value is None or value == "":
        return value
    result = transform(value)
    return result if result is not None else value


def postprocess_extracted(
    parsed: dict[str, Any],
    doc_type: str,
    *,
    company_registry: Sequence[str] = (),
    fuzz_threshold: int = 85,
) -> dict[str, Any]:
    """Apply per-doc-type field normalizations to an LLM-extracted dict.

    Returns a NEW dict (input is not mutated). Unknown `doc_type`
    values pass through unchanged — the caller is responsible for
    routing to a known type before postprocessing matters.
    """
    out: dict[str, Any] = dict(parsed)

    # Weight scalars
    for field in _WEIGHT_FIELDS.get(doc_type, frozenset()):
        if field in out:
            out[field] = _apply_or_keep(out[field], normalize_weight_4dp)

    # Date scalars (single string)
    for field in _DATE_FIELDS.get(doc_type, frozenset()):
        if field in out:
            out[field] = _apply_or_keep(out[field], normalize_date_iso)

    # Date lists (e.g. DeliveryOrder.date is `list[str]`)
    for field in _DATE_LIST_FIELDS.get(doc_type, frozenset()):
        if field in out and isinstance(out[field], list):
            out[field] = [
                _apply_or_keep(item, normalize_date_iso) for item in out[field]
            ]

    # Plate whitespace — handles both list fields (DeliveryOrder.vehicle_number)
    # and scalar fields (WeighingBill.vehicle_no, PetrolBill.plate_number).
    for field in _PLATE_FIELDS.get(doc_type, frozenset()):
        if field in out and isinstance(out[field], list):
            out[field] = [_apply_or_keep(item, normalize_plate) for item in out[field]]
        elif field in out:
            out[field] = _apply_or_keep(out[field], normalize_plate)

    # Company canonicalization (no-op when registry is empty)
    if company_registry:
        for field in _COMPANY_FIELDS.get(doc_type, frozenset()):
            if field in out and out[field]:

                def _canon(name: str) -> str | None:
                    canonical, _score = canonicalize_company(
                        name, company_registry, threshold=fuzz_threshold
                    )
                    return canonical

                out[field] = _apply_or_keep(out[field], _canon)

    # Item lists (rebuild fully so nested dicts aren't shared)
    for list_field, inner_field in _ITEM_LIST_RULES.get(doc_type, {}).items():
        if list_field in out and isinstance(out[list_field], list):
            out[list_field] = [
                {
                    **item,
                    inner_field: _apply_or_keep(
                        item.get(inner_field), normalize_weight_4dp
                    ),
                }
                if isinstance(item, dict) and inner_field in item
                else item
                for item in out[list_field]
            ]

    # Aggregate totals from line items when LLM left them missing.
    for aggregate_field, item_inner_field in _AGGREGATE_RULES.get(doc_type, {}).items():
        if aggregate_field not in out or out[aggregate_field] in (None, ""):
            items = out.get("items")
            if not isinstance(items, list) or not items:
                continue
            values: list[float] = []
            unit_suffix = ""
            for item in items:
                raw = item.get(item_inner_field) if isinstance(item, dict) else None
                if not raw:
                    continue
                if aggregate_field == "total_weight_mt":
                    weight_val = _parse_numeric_weight(raw)
                    if weight_val is not None:
                        values.append(weight_val)
                        if not unit_suffix:
                            m = _WEIGHT_RE.match(raw)
                            if m and m.group(2):
                                unit_suffix = f" {m.group(2).strip()}"
                else:
                    try:
                        num = float(str(raw).replace(",", ""))
                        values.append(num)
                    except ValueError:
                        pass
            if not values:
                continue
            total = sum(values)
            if aggregate_field == "total_weight_mt":
                out[aggregate_field] = f"{total:.4f}{unit_suffix}"
            else:
                out[aggregate_field] = (
                    str(int(total)) if total == int(total) else f"{total}"
                )

    return out
