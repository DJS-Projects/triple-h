"""Tests for public-spec extraction validators.

Real-world plate samples sourced from Wikipedia's running-numbers list
(en.wikipedia.org/wiki/Vehicle_registration_plates_of_Malaysia). TIN
samples synthetic but format-valid per ClearTax/LHDN spec.

If a regex over-rejects a real sample we hit in production, the right
fix is to add the sample here and tighten the regex against it — never
loosen-and-pray.
"""

from __future__ import annotations

import pytest

from app.services.extraction.validators import (
    DATE_HINT,
    PLATE_DIPLOMATIC,
    PLATE_MILITARY,
    PLATE_PENINSULAR,
    PLATE_SABAH,
    PLATE_SARAWAK,
    PLATE_TAXI,
    PLATE_TRAILER,
    POSTCODE,
    TIN_ANY,
    is_valid_plate,
    is_valid_tin,
    normalize_diameter,
    normalize_plate,
    state_for_postcode,
)


# ─── Plate normalization ─────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("WXY 1234", "WXY1234"),
        ("wxy 1234", "WXY1234"),
        ("  KV  2926 E  ", "KV2926E"),
        ("Q\tAB 2397 L", "QAB2397L"),
    ],
)
def test_normalize_plate_strips_and_uppercases(raw: str, expected: str) -> None:
    assert normalize_plate(raw) == expected


# ─── Peninsular plates ───────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "plate",
    [
        # Real running-series prefixes from Wikipedia (current at time of writing)
        "APH1234",  # Perak
        "BSP9999",  # Selangor
        "CFG500",  # Pahang
        "DFP1",  # Kelantan
        "JYV1234",  # Johor
        "KGF8888",  # Kedah
        "LH2861",  # Labuan
        "MEF777",  # Malacca
        "NEK100",  # Negeri Sembilan
        "PSB42",  # Penang
        "RBD9",  # Perlis
        "TDG1234",  # Terengganu
        "VQW1234",  # KL (current V-series)
        "W4321",  # KL legacy single-letter form
        "WXY1234",  # KL legacy 3-letter
        "JWP8186",  # Johor — the disambiguation example from hhh prompt
        "KV2926E",  # Langkawi w/ suffix letter
        "FH1",  # Putrajaya, lower bound (1 digit, no leading zero)
        "B1",  # Selangor, single-letter + 1 digit
    ],
)
def test_plate_peninsular_accepts_real_samples(plate: str) -> None:
    assert PLATE_PENINSULAR.match(plate), f"should accept {plate}"


@pytest.mark.parametrize(
    "plate,reason",
    [
        ("WIY1234", "I excluded universally"),
        ("WOI1234", "O and I excluded"),
        ("WZI1234", "Z reserved military"),
        ("W0001", "leading zero forbidden"),
        ("WXY12345", "5-digit overflow"),
        ("WXY", "no digit section"),
        ("1234", "no alpha prefix"),
        ("ZXC1234", "Z is military prefix only, not state"),
    ],
)
def test_plate_peninsular_rejects_invalid(plate: str, reason: str) -> None:
    assert not PLATE_PENINSULAR.match(plate), f"should reject {plate}: {reason}"


# ─── Sarawak plates ──────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "plate",
    [
        "QAB2397L",  # Kuching division
        "QM1A",  # Miri division minimal
        "QSF1234C",  # Sibu government series
        "QKA9999Y",  # Kuching, max digits, max suffix
    ],
)
def test_plate_sarawak_accepts(plate: str) -> None:
    assert PLATE_SARAWAK.match(plate)


def test_plate_sarawak_rejects_non_q_prefix() -> None:
    assert not PLATE_SARAWAK.match("PAB2397L")  # Penang prefix, not Sarawak


# ─── Sabah plates ────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "plate",
    [
        "SAA1A",  # West Coast minimal
        "SB1234X",  # Beaufort
        "SW9999Y",  # Tawau, max digits + max-letter suffix
        "SY1A",  # West Coast (Y division)
    ],
)
def test_plate_sabah_accepts(plate: str) -> None:
    assert PLATE_SABAH.match(plate)


@pytest.mark.parametrize(
    "plate,reason",
    [
        ("SAQ1A", "Q excluded in Sabah alpha positions"),
        ("SAS1A", "S excluded in Sabah alpha positions"),
        ("SAI1A", "I excluded universally"),
        ("SAA1Q", "Q excluded in Sabah suffix"),
    ],
)
def test_plate_sabah_rejects_invalid(plate: str, reason: str) -> None:
    assert not PLATE_SABAH.match(plate), reason


# ─── Taxi plates ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "plate",
    [
        "HW3350",  # KL taxi
        "HB123",  # Selangor taxi
        "HJ1",  # Johor minimal
        "HW0001",  # leading zeros allowed for taxis (per JPJ convention)
    ],
)
def test_plate_taxi_accepts(plate: str) -> None:
    assert PLATE_TAXI.match(plate)


# ─── Military plates ─────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "plate,branch",
    [
        ("ZA1234", "Army"),
        ("ZL5010", "Navy"),
        ("ZU777", "Air Force"),
        ("ZD1", "Army minimal"),
    ],
)
def test_plate_military_accepts(plate: str, branch: str) -> None:
    assert PLATE_MILITARY.match(plate), branch


def test_plate_military_rejects_civilian_z_branch() -> None:
    # Z only valid as MILITARY branch; ZF, ZG etc don't exist.
    assert not PLATE_MILITARY.match("ZF1234")


# ─── Trailer plates ──────────────────────────────────────────────────────────


def test_plate_trailer_accepts() -> None:
    assert PLATE_TRAILER.match("T/BD6125")


# ─── Diplomatic plates ───────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "plate",
    [
        "39-08-DC",  # Singapore diplomatic (per Wikipedia country code 39)
        "49-01-CC",  # China consular
        "01-99-UN",
        "10-50-PA",
    ],
)
def test_plate_diplomatic_accepts(plate: str) -> None:
    assert PLATE_DIPLOMATIC.match(plate)


def test_plate_diplomatic_rejects_unknown_suffix() -> None:
    assert not PLATE_DIPLOMATIC.match("39-08-XY")


# ─── Composite plate matcher ─────────────────────────────────────────────────


def test_is_valid_plate_handles_whitespace_and_case() -> None:
    assert is_valid_plate("wxy 1234")
    assert is_valid_plate("  KV 2926 E  ")
    assert not is_valid_plate("definitely not a plate")


# ─── Postcodes + state mapping ───────────────────────────────────────────────


@pytest.mark.parametrize(
    "code,state",
    [
        # Boundary samples per Wikipedia ranges
        ("01000", "Perlis"),
        ("02999", "Perlis"),
        ("05100", "Kedah"),  # Alor Setar
        ("09810", "Kedah"),
        ("06050", "Kedah"),  # Bukit Kayu Hitam (cited in hhh prompt)
        ("10000", "Penang"),
        ("14400", "Penang"),
        ("15000", "Kelantan"),
        ("28800", "Pahang"),
        ("39000", "Pahang"),  # Cameron Highlands (split range)
        ("39200", "Pahang"),
        ("40000", "Selangor"),
        ("42000", "Selangor"),  # Port Klang
        ("48300", "Selangor"),
        ("49000", "Pahang"),  # Genting Highlands (split range)
        ("50000", "Kuala Lumpur"),
        ("60000", "Kuala Lumpur"),
        ("62300", "Putrajaya"),
        ("62988", "Putrajaya"),
        ("63000", "Selangor"),
        ("68100", "Selangor"),
        ("69000", "Pahang"),  # Fraser's Hill (split range)
        ("70000", "Negeri Sembilan"),
        ("75000", "Malacca"),
        ("79000", "Johor"),
        ("87000", "Labuan"),
        ("88000", "Sabah"),
        ("93000", "Sarawak"),
        ("98859", "Sarawak"),
    ],
)
def test_state_for_postcode_known_ranges(code: str, state: str) -> None:
    assert state_for_postcode(code) == state


@pytest.mark.parametrize("code", ["00000", "04000", "99999", "abcde", "1234", "123456"])
def test_state_for_postcode_unknown_or_malformed_returns_none(code: str) -> None:
    assert state_for_postcode(code) is None


def test_postcode_regex_matches_inside_address() -> None:
    addr = (
        "8, Lorong Bakap Indah 10, Taman Bakap Indah, 14200 Sungai Bakap, Pulau Pinang"
    )
    m = POSTCODE.search(addr)
    assert m is not None
    assert m.group(0) == "14200"


# ─── TIN ─────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "tin,kind",
    [
        ("IG845462070", "Individual current 9 digits (variable length)"),
        ("IG12345678901", "Individual current 11 digits"),
        ("SG12345678901", "Legacy individual SG"),
        ("OG12345678901", "Legacy individual OG"),
        ("C20830570210", "Company"),
        ("D12345678901", "Partnership"),
        ("PT12345678901", "LLP"),
        ("E12345678901", "Employer"),
        ("F12345678901", "Association"),
        ("FA12345678901", "Non-resident public entertainer"),
        ("CS1234567890", "Cooperative — 10 digits"),
        ("TA12345678901", "Trust body"),
        ("TC12345678901", "Unit/Property trust"),
        ("TN12345678901", "Business trust"),
        ("TR12345678901", "REIT"),
        ("TP12345678901", "Deceased estate"),
        ("J12345678901", "Hindu Joint Family"),
        ("LE12345678901", "Labuan entity"),
    ],
)
def test_tin_any_accepts_documented_prefixes(tin: str, kind: str) -> None:
    assert TIN_ANY.match(tin), kind


@pytest.mark.parametrize(
    "tin",
    [
        "IG12345678",  # too short (8 digits — below 9 minimum for IG)
        "C1234567890",  # too short (10 — company needs 11)
        "C123456789012",  # too long (12)
        "Z12345678901",  # unknown prefix
        "12345678901",  # no prefix
        "ig12345678901",  # mixed case — caller must uppercase first
    ],
)
def test_tin_any_rejects_invalid(tin: str) -> None:
    assert not TIN_ANY.match(tin)


def test_is_valid_tin_strips_whitespace_and_uppercases() -> None:
    assert is_valid_tin("c20830570210")
    assert is_valid_tin("C 20830570210")
    assert is_valid_tin("  ig 845462070  ")
    assert not is_valid_tin("not a tin")


# ─── Diameter normalization ──────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("φ16mm steel", "⌀16mm steel"),
        ("Φ16", "⌀16"),
        ("Ø16mm", "⌀16mm"),
        ("ø16mm", "⌀16mm"),
        ("⌀16mm", "⌀16mm"),  # already canonical
        ("16mm", "16mm"),  # no diameter symbol
    ],
)
def test_normalize_diameter(raw: str, expected: str) -> None:
    assert normalize_diameter(raw) == expected


# ─── Date hint regex ─────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Issued 25/11/2025 by", "25/11/2025"),
        ("Date: 2025-11-25 confirmed", "2025-11-25"),
        ("DD-MM-YYYY: 1-1-25", "1-1-25"),
        ("Stamped 25.11.2025", "25.11.2025"),
    ],
)
def test_date_hint_finds_common_formats(text: str, expected: str) -> None:
    m = DATE_HINT.search(text)
    assert m is not None
    assert m.group(1) == expected


def test_date_hint_skips_non_date_digits() -> None:
    # Phone number, postcode, etc shouldn't match.
    assert DATE_HINT.search("Tel: 014-391 3419") is None
    assert DATE_HINT.search("postcode 14200") is None
