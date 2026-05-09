"""Tests for the deterministic LLM-output postprocessor.

Mirror structure of test_extraction_preprocess.py: each transformation
has its own parametrized table, plus integration coverage for the
composite `postprocess_extracted` dispatcher.
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.extraction.postprocess import (
    canonicalize_company,
    normalize_date_iso,
    normalize_weight_4dp,
    postprocess_extracted,
)


# ─── Weight 4dp normalization ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("12.5 MT", "12.5000 MT"),
        ("42.40 t", "42.4000 t"),
        ("0.00", "0.0000"),
        ("0", "0.0000"),
        ("1234", "1234.0000"),
        # No-unit numeric
        ("28.20", "28.2000"),
        # Thousands separator
        ("1,234.56 mt", "1234.5600 mt"),
        # No space between numeric and unit
        ("42.40t", "42.4000t"),
        # Already 4dp
        ("42.4000 MT", "42.4000 MT"),
        # Leading/trailing whitespace stripped on numeric, unit kept verbatim
        ("  12.5  MT  ", "12.5000 MT"),
    ],
)
def test_normalize_weight_4dp(raw: str, expected: str) -> None:
    assert normalize_weight_4dp(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "abc",
        "MT only",
        "n/a",
        "—",
    ],
)
def test_normalize_weight_4dp_returns_none_on_unparseable(raw: str) -> None:
    assert normalize_weight_4dp(raw) is None


def test_normalize_weight_4dp_negative_passes_through() -> None:
    # Negative weights are nonsensical in domain but the formatter
    # should not crash; downstream validators decide what to do.
    assert normalize_weight_4dp("-1.5 t") == "-1.5000 t"


# ─── Date ISO normalization ──────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        # MY convention: DD/MM/YYYY → dayfirst=True
        ("25/11/2025", "2025-11-25"),
        ("5/12/2025", "2025-12-05"),
        # Already ISO
        ("2025-11-25", "2025-11-25"),
        # Dotted
        ("25.11.2025", "2025-11-25"),
        # Hyphenated DMY
        ("25-11-2025", "2025-11-25"),
        # 2-digit year (dateutil resolves with sliding window)
        ("25/11/25", "2025-11-25"),
    ],
)
def test_normalize_date_iso(raw: str, expected: str) -> None:
    assert normalize_date_iso(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "no date here",
        "99/99/9999",  # parses as garbage
        "32/13/2025",  # invalid
    ],
)
def test_normalize_date_iso_returns_none_on_unparseable(raw: str) -> None:
    assert normalize_date_iso(raw) is None


# ─── Company canonicalization ────────────────────────────────────────────────


_REGISTRY = (
    "GBI Mesh & Bar Trading Sdn. Bhd.",
    "Coltron Construction Sdn. Bhd.",
    "EC Excel Wire Sdn. Bhd.",
    "Eng Soon Hardware Trading Sdn. Bhd.",
    "Hillhome Builder Sdn. Bhd.",
)


def test_canonicalize_company_exact_match() -> None:
    canonical, score = canonicalize_company(
        "GBI Mesh & Bar Trading Sdn. Bhd.", _REGISTRY
    )
    assert canonical == "GBI Mesh & Bar Trading Sdn. Bhd."
    assert score == 100


def test_canonicalize_company_squashed_input_matches() -> None:
    # OCR commonly drops spaces — rule §18 example from hhh prompt.
    canonical, _score = canonicalize_company("GBIMESH&BARTRADING SDN.BHD.", _REGISTRY)
    assert canonical == "GBI Mesh & Bar Trading Sdn. Bhd."


def test_canonicalize_company_lowercased_input_matches() -> None:
    canonical, _score = canonicalize_company("coltronconstructionsdn.bhd.", _REGISTRY)
    assert canonical == "Coltron Construction Sdn. Bhd."


def test_canonicalize_company_below_threshold_returns_none() -> None:
    canonical, score = canonicalize_company(
        "Totally Unrelated Pty Ltd", _REGISTRY, threshold=85
    )
    assert canonical is None
    # Score still reported so callers can log near-misses.
    assert 0 <= score < 85


def test_canonicalize_company_empty_registry_returns_none() -> None:
    canonical, score = canonicalize_company("Anything", [])
    assert canonical is None
    assert score == 0


def test_canonicalize_company_empty_input_returns_none() -> None:
    canonical, _score = canonicalize_company("", _REGISTRY)
    assert canonical is None


# ─── Composite postprocess dispatcher ────────────────────────────────────────


def test_postprocess_extracted_delivery_order_normalizes_weights() -> None:
    parsed = {
        "do_issuer_name": "GBIMESH&BARTRADING SDN.BHD.",
        "sold_to": "Coltron Construction Sdn Bhd",
        "do_number": ["DO101l"],
        "date": ["25/11/2025"],
        "items": [
            {"description": "Steel Bar", "quantity": "10", "weight_mt": "12.5"},
            {"description": "Mesh", "quantity": "5", "weight_mt": "0"},
        ],
        "total_weight_mt": "12.5",
    }
    out = postprocess_extracted(parsed, "delivery_order", company_registry=_REGISTRY)
    # Weights normalized to 4dp
    assert out["items"][0]["weight_mt"] == "12.5000"
    assert out["items"][1]["weight_mt"] == "0.0000"
    assert out["total_weight_mt"] == "12.5000"
    # Date normalized to ISO
    assert out["date"] == ["2025-11-25"]
    # Companies canonicalized
    assert out["do_issuer_name"] == "GBI Mesh & Bar Trading Sdn. Bhd."
    assert out["sold_to"] == "Coltron Construction Sdn. Bhd."


def test_postprocess_extracted_weighing_bill_normalizes_all_weights() -> None:
    parsed = {
        "weighing_no": "202301011234",
        "gross_weight": "42.40",
        "tare_weight": "14.20",
        "net_weight": "28.20",
        "off_weight": "0",
        "actual_weight": "28.20",
    }
    out = postprocess_extracted(parsed, "weighing_bill")
    assert out["gross_weight"] == "42.4000"
    assert out["tare_weight"] == "14.2000"
    assert out["net_weight"] == "28.2000"
    # Rule §9: must display zero weight as 0.0000
    assert out["off_weight"] == "0.0000"
    assert out["actual_weight"] == "28.2000"


def test_postprocess_extracted_invoice_normalizes_date_and_companies() -> None:
    parsed = {
        "invoice_number": "INV-001",
        "invoice_date": "25/11/2025",
        "bill_to": "GBIMESH&BARTRADING SDN.BHD.",
        "from_company": "Coltron Construction Sdn Bhd",
    }
    out = postprocess_extracted(parsed, "invoice", company_registry=_REGISTRY)
    assert out["invoice_date"] == "2025-11-25"
    assert out["bill_to"] == "GBI Mesh & Bar Trading Sdn. Bhd."
    assert out["from_company"] == "Coltron Construction Sdn. Bhd."


def test_postprocess_extracted_petrol_bill_normalizes_datetime() -> None:
    parsed = {
        "station_name": "Petronas",
        "purchase_datetime": "25/11/2025",
        "litres": "30.50",
    }
    out = postprocess_extracted(parsed, "petrol_bill")
    assert out["purchase_datetime"] == "2025-11-25"


def test_postprocess_extracted_does_not_mutate_input() -> None:
    parsed: dict[str, Any] = {
        "items": [{"weight_mt": "12.5"}],
        "date": ["25/11/2025"],
        "total_weight_mt": "12.5",
    }
    snapshot_items = parsed["items"][0]["weight_mt"]
    snapshot_date = parsed["date"][0]
    _ = postprocess_extracted(parsed, "delivery_order")
    assert parsed["items"][0]["weight_mt"] == snapshot_items
    assert parsed["date"][0] == snapshot_date
    assert parsed["total_weight_mt"] == "12.5"


def test_postprocess_extracted_preserves_unhandled_keys() -> None:
    parsed = {
        "weighing_no": "12345",
        "remark": "Some free text — keep me!",
        "gross_weight": "42.4",
    }
    out = postprocess_extracted(parsed, "weighing_bill")
    assert out["remark"] == "Some free text — keep me!"
    assert out["weighing_no"] == "12345"


def test_postprocess_extracted_skips_none_values() -> None:
    parsed = {
        "gross_weight": None,
        "tare_weight": "14.2",
        "net_weight": None,
    }
    out = postprocess_extracted(parsed, "weighing_bill")
    assert out["gross_weight"] is None
    assert out["tare_weight"] == "14.2000"
    assert out["net_weight"] is None


def test_postprocess_extracted_unparseable_date_falls_back_to_input() -> None:
    # Postprocess never deletes content; if normalization fails the
    # original value is preserved so the review UI can flag it.
    parsed = {"invoice_date": "not a date"}
    out = postprocess_extracted(parsed, "invoice")
    assert out["invoice_date"] == "not a date"


def test_postprocess_extracted_unparseable_weight_falls_back_to_input() -> None:
    parsed = {"gross_weight": "n/a"}
    out = postprocess_extracted(parsed, "weighing_bill")
    assert out["gross_weight"] == "n/a"


def test_postprocess_extracted_unknown_doc_type_passes_through() -> None:
    parsed = {"foo": "bar", "weight_mt": "12.5"}
    out = postprocess_extracted(parsed, "unknown_type")  # type: ignore[arg-type]
    assert out == parsed


def test_postprocess_extracted_no_registry_skips_company_canonicalization() -> None:
    parsed = {"sold_to": "Coltron Construction Sdn Bhd"}
    out = postprocess_extracted(parsed, "delivery_order")
    # No registry → name passes through verbatim.
    assert out["sold_to"] == "Coltron Construction Sdn Bhd"


def test_postprocess_extracted_canonicalization_below_threshold_keeps_original() -> (
    None
):
    parsed = {"sold_to": "Totally Unrelated Pty Ltd"}
    out = postprocess_extracted(
        parsed, "delivery_order", company_registry=_REGISTRY, fuzz_threshold=85
    )
    assert out["sold_to"] == "Totally Unrelated Pty Ltd"
