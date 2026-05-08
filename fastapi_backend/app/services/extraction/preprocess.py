"""Deterministic preprocessing of OCR text before LLM extraction.

These transformations are pure functions of OCR output — no model
calls, no randomness, fully testable. Their role is to absorb the
"obvious correction" rules that the reference implementation buried
inside its prompt template (OCR fragment recovery, date-anchored
character correction, diameter normalization).

The classic prompt-driven approach asks the LLM to do all of this on
every call: paragraphs of "MUST DO: replace S with 5 in numeric
contexts." That's wasted compute and non-deterministic. Doing it here
once means the LLM gets cleaner text and we get tests.

Boundary contract:
  - Input: Chandra-emitted block text (HTML stripped) or raw OCR string.
  - Output: same text with deterministic corrections applied.
  - Never invents content; never deletes content; never reorders tokens.
  - When a transformation is unsafe without context (e.g. char
    correction with no anchor date), the function returns input
    unchanged rather than guessing.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Final

from dateutil import parser as date_parser

from app.services.extraction.validators import (
    DATE_HINT,
    normalize_diameter,
)

# ─── OCR fragment glossary ───────────────────────────────────────────────────

# Common OCR fragmentation patterns. Conservative: only entries we've
# seen in the reference repo's prompt or in our own fixtures. Every
# entry here is a phrase replacement, NOT a regex — keeps lookahead
# and ambiguity out of the rule.
#
# To add: confirm the broken phrase appears in real fixtures (grep
# tests_eval/fixtures/), then add row + a test case.
_FRAGMENT_GLOSSARY: Final[dict[str, str]] = {
    # delivery order
    "delivery yorder": "delivery order",
    "deliveryorder": "delivery order",
    # invoice
    "in voice": "invoice",
    "invoive": "invoice",
    # weighing
    "net wt": "net weight",
    "gros s wt": "gross weight",
    "gross wt": "gross weight",
    "tare wt": "tare weight",
    "wei ghing": "weighing",
}


def _compile_glossary(rules: dict[str, str]) -> re.Pattern[str]:
    """Build a single case-insensitive alternation that fires once per pass."""
    if not rules:
        return re.compile(r"(?!.*)")  # never matches
    parts = sorted(rules.keys(), key=len, reverse=True)
    return re.compile("|".join(re.escape(p) for p in parts), flags=re.IGNORECASE)


_GLOSSARY_RE: Final = _compile_glossary(_FRAGMENT_GLOSSARY)


def repair_ocr_fragments(text: str) -> str:
    """Apply the OCR fragment glossary case-insensitively, preserving the
    case style of the canonical replacement (lowercase as registered)."""

    def _sub(m: re.Match[str]) -> str:
        return _FRAGMENT_GLOSSARY[m.group(0).lower()]

    return _GLOSSARY_RE.sub(_sub, text)


# ─── Address normalization ───────────────────────────────────────────────────

# Reference repo rule §14: "after postal code, there shall be a space
# before the state name". OCR sometimes glues the state onto the
# postcode ("14200Sungai Bakap"). We insert a single space when a
# 5-digit postcode is followed directly by an alpha char.
_POSTCODE_GLUED = re.compile(r"(\d{5})([A-Za-z])")


def normalize_postcode_spacing(text: str) -> str:
    """Insert a space between a 5-digit postcode and a directly-following letter."""
    return _POSTCODE_GLUED.sub(r"\1 \2", text)


# ─── Document date extraction ────────────────────────────────────────────────


# Date strings can appear in many shapes. We collect every shape match
# from `DATE_HINT`, parse with dateutil (dayfirst=True for MY
# convention), and return the earliest valid date. Earliest because
# the document date (issuance) typically anchors all other timestamps;
# return-by-courier dates and similar postdate fields shouldn't win.
def extract_document_date(text: str) -> date | None:
    """Return the earliest parseable date in `text`, or None.

    Uses `dateutil.parser` with `dayfirst=True` — Malaysia uses DD/MM/YYYY
    by convention. Returns `None` when no date hint matches or every
    candidate fails to parse (e.g. OCR-mangled digits).
    """
    candidates: list[date] = []
    for m in DATE_HINT.finditer(text):
        token = m.group(1)
        try:
            parsed = date_parser.parse(token, dayfirst=True, fuzzy=False)
        except (ValueError, OverflowError):
            continue
        candidates.append(parsed.date())
    if not candidates:
        return None
    return min(candidates)


# ─── Date-anchored character correction ──────────────────────────────────────

# OCR substitutions that the reference repo dedicates ~30 prompt lines
# to. Encoded once here, applied deterministically. Mapping is
# alpha→digit only — the inverse never happens (we don't replace digits
# with letters).
_OCR_DIGIT_SUBS: Final[dict[str, str]] = {
    "S": "5",
    "l": "1",
    "I": "1",
    "O": "0",
    "Z": "2",
    "B": "8",
    "G": "6",
}


def correct_id_chars(code: str, doc_date: date | None) -> str:
    """Substitute ambiguous letters with digits inside an alphanumeric code.

    Algorithm: split at the first digit. The prefix (letters before any
    digit) is the issuer/document tag and is preserved verbatim — e.g.
    `LXSKJ` in Alliance Steel POs, `PO`/`DO` for purchase/delivery
    orders. The tail (everything from the first digit onward) is
    treated as numeric territory, where letters in `_OCR_DIGIT_SUBS`
    are replaced with their digit equivalents.

    Only operates when:
      1. The code contains at least one digit (otherwise it's a word).
      2. A document date is available as anchor (sanity check; we rely
         on the *presence* of a date as evidence the caller has reason
         to believe this is a real ID, not free-form text).

    Returns the corrected code, or the input unchanged when conditions
    don't hold.
    """
    if doc_date is None:
        return code

    first_digit = -1
    for i, ch in enumerate(code):
        if ch.isdigit():
            first_digit = i
            break
    if first_digit == -1:
        return code  # no digits → not an ID code

    prefix = code[:first_digit]
    tail = code[first_digit:]
    corrected_tail = "".join(_OCR_DIGIT_SUBS.get(c, c) for c in tail)
    return prefix + corrected_tail


# ─── Top-level preprocessor ──────────────────────────────────────────────────


def preprocess_text(text: str) -> str:
    """Apply the full deterministic preprocessing pipeline.

    Order matters:
      1. OCR fragment glossary first (may unblock subsequent rules by
         restoring word boundaries).
      2. Diameter normalization (Unicode level, no other dependency).
      3. Postcode-state spacing (after fragment repair so split tokens
         re-merge correctly).

    Note: `correct_id_chars` is NOT applied here. It runs per-candidate
    inside `anchors.py` once the candidate has been isolated by label
    proximity or table column header — running it on free text would
    corrupt legitimate words like "ROBINSON" → "R0B1N50N".
    """
    text = repair_ocr_fragments(text)
    text = normalize_diameter(text)
    text = normalize_postcode_spacing(text)
    return text
