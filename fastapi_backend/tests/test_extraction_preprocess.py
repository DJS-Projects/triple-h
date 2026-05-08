"""Tests for the deterministic OCR preprocessor.

Each transformation has its own parametrized table because they're
independent passes — failures should pinpoint the rule, not the
composite.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.services.extraction.preprocess import (
    correct_id_chars,
    extract_document_date,
    normalize_postcode_spacing,
    preprocess_text,
    repair_ocr_fragments,
)


# ─── OCR fragment glossary ───────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Original delivery yorder reference", "Original delivery order reference"),
        ("Stamped: in voice", "Stamped: invoice"),
        ("net wt: 28.20 t", "net weight: 28.20 t"),
        ("gros s wt 42.40 t", "gross weight 42.40 t"),
        ("CASE INSENSITIVE: Net Wt", "CASE INSENSITIVE: net weight"),
        # Multiple in one string
        ("Page 1 in voice; Page 2 net wt 14t", "Page 1 invoice; Page 2 net weight 14t"),
    ],
)
def test_repair_ocr_fragments(raw: str, expected: str) -> None:
    assert repair_ocr_fragments(raw) == expected


def test_repair_ocr_fragments_leaves_clean_text_unchanged() -> None:
    text = "Delivery order issued by Alliance Steel"
    assert repair_ocr_fragments(text) == text


# ─── Postcode spacing ────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("14200Sungai Bakap", "14200 Sungai Bakap"),
        ("06050Bukit Kayu Hitam", "06050 Bukit Kayu Hitam"),
        ("Already 14200 Spaced", "Already 14200 Spaced"),
        ("postal12345abc", "postal12345 abc"),
    ],
)
def test_normalize_postcode_spacing(raw: str, expected: str) -> None:
    assert normalize_postcode_spacing(raw) == expected


def test_postcode_spacing_does_not_touch_digit_runs_followed_by_digits() -> None:
    # Phone numbers shouldn't trigger.
    assert normalize_postcode_spacing("Tel: 0143913419") == "Tel: 0143913419"


# ─── Document date extraction ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Issued 25/11/2025", date(2025, 11, 25)),
        ("Date: 2025-11-25", date(2025, 11, 25)),
        ("Stamped 25.11.2025", date(2025, 11, 25)),
        # MY convention is DD/MM/YYYY → dayfirst=True
        ("Issued 5/12/2025", date(2025, 12, 5)),
        # Multiple dates → earliest wins (anchors document issuance)
        (
            "Issued 25/11/2025. Delivered 27/11/2025. Returned 30/11/2025.",
            date(2025, 11, 25),
        ),
    ],
)
def test_extract_document_date(text: str, expected: date) -> None:
    assert extract_document_date(text) == expected


def test_extract_document_date_returns_none_when_absent() -> None:
    assert extract_document_date("No date here at all") is None


def test_extract_document_date_skips_unparseable_tokens() -> None:
    # 99/99/9999 hits the regex but fails dateutil — should not crash, returns None.
    assert extract_document_date("Garbage 99/99/9999") is None


# ─── Date-anchored char correction ───────────────────────────────────────────


@pytest.mark.parametrize(
    "code,anchor,expected",
    [
        # Reference example from hhh prompt: PO2S1l with date 25/11/2025 → PO2511
        ("PO2S1l", date(2025, 11, 25), "PO2511"),
        # Alliance Steel-style: alpha prefix preserved, embedded letters fixed
        ("LXSKJ202S001", date(2025, 11, 25), "LXSKJ2025001"),
        ("LXSKJ20250O1-1O-1O-123", date(2025, 11, 25), "LXSKJ2025001-10-10-123"),
        # Already-clean code passes through unchanged
        ("PO2511", date(2025, 11, 25), "PO2511"),
        # Lowercase 'l' inside a digit run
        ("DO101l", date(2025, 11, 25), "DO1011"),
    ],
)
def test_correct_id_chars(code: str, anchor: date, expected: str) -> None:
    assert correct_id_chars(code, anchor) == expected


def test_correct_id_chars_skips_when_no_anchor() -> None:
    # No date → don't risk corrupting alpha words.
    assert correct_id_chars("PO2S1l", None) == "PO2S1l"


def test_correct_id_chars_skips_pure_alpha_word() -> None:
    # 'ROBINSON' has no digits → not an ID code → leave alone.
    assert correct_id_chars("ROBINSON", date(2025, 11, 25)) == "ROBINSON"


def test_correct_id_chars_preserves_alpha_prefix() -> None:
    # 'LXSKJ' is the issuer prefix; only the digit-dominant tail gets corrected.
    assert correct_id_chars("LXSKJ", date(2025, 11, 25)) == "LXSKJ"


def test_correct_id_chars_with_separators_inside_digit_run() -> None:
    # Hyphens inside a digit-dominant run are fine.
    assert correct_id_chars("202S-OO1-12", date(2025, 11, 25)) == "2025-001-12"


# ─── Composite preprocess_text ───────────────────────────────────────────────


def test_preprocess_text_chains_all_rules() -> None:
    raw = "in voice issued 25/11/2025 to GBI Mesh, 14200Sungai Bakap. Φ16mm steel."
    out = preprocess_text(raw)
    assert "invoice issued" in out
    assert "14200 Sungai Bakap" in out
    assert "⌀16mm steel" in out


def test_preprocess_text_does_not_run_id_correction() -> None:
    # Char correction is per-candidate, not per-document. Composite must
    # leave alpha words alone — this guards against corrupting names.
    raw = "ROBINSON 25/11/2025"
    assert preprocess_text(raw) == raw
