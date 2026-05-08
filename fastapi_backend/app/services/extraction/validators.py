"""Public-spec format validators.

Every regex here corresponds to a documented external standard
(JPJ vehicle registration, Pos Malaysia postcodes, LHDN Tax
Identification Number, Unicode). Customer-internal codes
(Alliance Steel PO/weighing-no, etc) live in `customer_patterns.py`
once derived from the fixture corpus — never invented from a single
sample.

Sources:
  - MY plates: en.wikipedia.org/wiki/Vehicle_registration_plates_of_Malaysia
    (consolidates JPJ running-number bulletins; JPJ doesn't publish
    a regex directly).
  - Postcodes: en.wikipedia.org/wiki/Postal_codes_in_Malaysia
  - TIN: cleartax.com/my/en/tin-malaysia (mirrors LHDN MyTax docs;
    OECD TIN PDF was binary-malformed at fetch time).
  - Diameter: Unicode 16.0, U+2300 DIAMETER SIGN.

Regex notes:
  - Letters I, O, Z are universally excluded from MY plate alpha
    positions to disambiguate from digits 1, 0 and to reserve Z for
    military exclusive.
  - Sabah additionally excludes Q, S in alpha positions to prevent
    cross-region confusion with pre-1991 formats.
  - Postcodes are 5 digits; ranges are non-contiguous for Selangor
    (40000-48300 + 63000-68100) and Pahang (multiple highland
    enclaves), so a single regex isn't enough — `state_for_postcode`
    consults the LUT.
  - TIN format changed 2023-01-02 (SG/OG → IG for individuals).
    Legacy SG/OG TINs remain valid in legacy invoices, so the
    combined matcher accepts both.
"""

from __future__ import annotations

import re
from typing import Final

# ─── Malaysian vehicle registration plates ───────────────────────────────────

# Letter exclusions: I, O, Z universal; Q, S additionally excluded in Sabah
# alpha positions.
_ALPHA_NO_IOZ = r"[A-HJ-NPQ-XY]"  # 23 letters: A..Y minus I, O, Z
_ALPHA_NO_IOZQS = r"[ABCDEFGHJKLMNPRTUVWXY]"  # Sabah alphabet positions

# Peninsular state prefixes (single letter). W is deprecated for KL (2016)
# but still appears on legacy vehicles → accepted here.
# A=Perak, B=Selangor, C=Pahang, D=Kelantan, F=Putrajaya, J=Johor,
# K=Kedah, L=Labuan, M=Malacca, N=Negeri Sembilan, P=Penang, R=Perlis,
# T=Terengganu, V=KL (current), W=KL (legacy).
PLATE_PENINSULAR: Final = re.compile(
    rf"^(?:[ABCDFHJKLMNPRTVW]|KV){_ALPHA_NO_IOZ}{{0,2}}[1-9]\d{{0,3}}{_ALPHA_NO_IOZ}?$"
)

# Sarawak: Q + division letter + alpha sequence + digits + suffix letter.
# Division prefixes: K/A=Kuching, B=Sri Aman/Betong, C=Samarahan/Serian,
# M=Miri, P=Kapit, R=Sarikei, S=Sibu/Mukah, T/D=Bintulu, L=Limbang.
PLATE_SARAWAK: Final = re.compile(
    rf"^Q[ABCDKLMPRST]{_ALPHA_NO_IOZ}{{0,2}}[1-9]\d{{0,3}}{_ALPHA_NO_IOZ}?$"
)

# Sabah: S + division letter + alpha sequence + digits + suffix letter.
# Division prefixes: A/Y/J=West Coast, B=Beaufort, D/P=Lahad Datu,
# K=Kudat, M/T=Sandakan, U=Keningau, W=Tawau.
# Note: L=Labuan is a separate Federal Territory using peninsular L-series,
# NOT a Sabah division.
PLATE_SABAH: Final = re.compile(
    rf"^S[ABDJKMPTUWY]{_ALPHA_NO_IOZQS}{{0,2}}[1-9]\d{{0,3}}{_ALPHA_NO_IOZQS}?$"
)

# Taxis: H + state letter (one of 14, no I/O/U/V/X/Y/Z) + optional alpha + 1-4 digits.
# Leading zeros allowed (per JPJ taxi numbering convention).
PLATE_TAXI: Final = re.compile(rf"^H[ABCDJKLMNPQRSTW]{_ALPHA_NO_IOZ}?\d{{1,4}}$")

# Military: Z + branch identifier + 1-9999.
# Branches: A/B/C/D=Army, L=Navy ("Laut"), U=Air Force ("Udara"),
# Z=MINDEF (rare).
PLATE_MILITARY: Final = re.compile(r"^Z[ABCDLUZ][1-9]\d{0,3}$")

# Trailer: T/ + state-or-division letter + optional alpha + digits.
PLATE_TRAILER: Final = re.compile(rf"^T/[A-Z]{_ALPHA_NO_IOZ}?\d{{1,4}}$")

# Diplomatic / Consular / UN / Other (PA = Palace/Protocol Authority).
# Format: ##-##-XX with leading zeros allowed.
PLATE_DIPLOMATIC: Final = re.compile(r"^\d{2}-\d{2}-(?:DC|CC|UN|PA)$")

# Composite matcher — does this look like ANY valid MY plate?
_PLATE_PATTERNS: Final = (
    PLATE_PENINSULAR,
    PLATE_SARAWAK,
    PLATE_SABAH,
    PLATE_TAXI,
    PLATE_MILITARY,
    PLATE_TRAILER,
    PLATE_DIPLOMATIC,
)


def normalize_plate(s: str) -> str:
    """Canonicalize a plate string for matching: uppercase, drop whitespace.

    Wikipedia notes spaces in written form are visual-only; the
    underlying registration is continuous. We strip whitespace before
    matching so 'WXY 1234' and 'WXY1234' both validate.
    """
    return re.sub(r"\s+", "", s).upper()


def is_valid_plate(s: str) -> bool:
    """True iff `s` matches any documented MY plate pattern."""
    canonical = normalize_plate(s)
    return any(p.match(canonical) for p in _PLATE_PATTERNS)


# ─── Malaysian postal codes ──────────────────────────────────────────────────

POSTCODE: Final = re.compile(r"\b\d{5}\b")

# State LUT — non-contiguous for Selangor (40000-48300, 63000-68100)
# and Pahang (highland enclaves at 39xxx, 49000, 69000). Order matters
# for overlapping ranges (KL 50000-60000 sits inside Selangor's gap).
_POSTCODE_RANGES: Final[tuple[tuple[int, int, str], ...]] = (
    (1000, 2999, "Perlis"),
    (5000, 9810, "Kedah"),
    (10000, 14400, "Penang"),
    (15000, 18500, "Kelantan"),
    (20000, 24300, "Terengganu"),
    (25000, 28800, "Pahang"),
    (30000, 36810, "Perak"),
    (39000, 39200, "Pahang"),
    (40000, 48300, "Selangor"),
    (49000, 49000, "Pahang"),
    (50000, 60000, "Kuala Lumpur"),
    (62300, 62988, "Putrajaya"),
    (63000, 68100, "Selangor"),
    (69000, 69000, "Pahang"),
    (70000, 73509, "Negeri Sembilan"),
    (75000, 78309, "Malacca"),
    (79000, 86900, "Johor"),
    (87000, 87033, "Labuan"),
    (88000, 91309, "Sabah"),
    (93000, 98859, "Sarawak"),
)


def state_for_postcode(s: str) -> str | None:
    """Map a 5-digit postcode to its state/federal territory.

    Returns None for syntactically valid postcodes that fall outside
    any documented range — these are typically OCR-corrupted digits
    rather than legitimate addresses.
    """
    if not POSTCODE.fullmatch(s):
        return None
    n = int(s)
    for lo, hi, state in _POSTCODE_RANGES:
        if lo <= n <= hi:
            return state
    return None


# ─── Malaysian Tax Identification Number (LHDN) ──────────────────────────────

# Active prefixes (post 2023-01-02). Digit count after prefix is fixed
# at 11 except for individual (variable 9-11) and cooperative (10).
TIN_INDIVIDUAL: Final = re.compile(r"^IG\d{9,11}$")
TIN_LEGACY_INDIVIDUAL: Final = re.compile(r"^(?:SG|OG)\d{9,11}$")
TIN_COMPANY: Final = re.compile(r"^C\d{11}$")
TIN_PARTNERSHIP: Final = re.compile(r"^D\d{11}$")
TIN_LLP: Final = re.compile(r"^PT\d{11}$")
TIN_EMPLOYER: Final = re.compile(r"^E\d{11}$")
TIN_ASSOCIATION: Final = re.compile(r"^F\d{11}$")
TIN_NRPE: Final = re.compile(r"^FA\d{11}$")  # non-resident public entertainer
TIN_COOPERATIVE: Final = re.compile(r"^CS\d{10}$")
TIN_TRUST_BODY: Final = re.compile(r"^TA\d{11}$")
TIN_UNIT_TRUST: Final = re.compile(r"^TC\d{11}$")
TIN_BUSINESS_TRUST: Final = re.compile(r"^TN\d{11}$")
TIN_REIT: Final = re.compile(r"^TR\d{11}$")
TIN_DECEASED_ESTATE: Final = re.compile(r"^TP\d{11}$")
TIN_HJF: Final = re.compile(r"^J\d{11}$")  # Hindu Joint Family
TIN_LABUAN_ENTITY: Final = re.compile(r"^LE\d{11}$")

# Combined matcher — accepts every active prefix plus legacy SG/OG.
# Order in alternation matters: longer prefixes first so PT/CS/FA/LE/TA/TC/TN/TR/TP
# don't get partial-matched as P/C/F/L/T followed by digits.
TIN_ANY: Final = re.compile(
    r"^(?:"
    r"IG\d{9,11}|(?:SG|OG)\d{9,11}|"
    r"PT\d{11}|CS\d{10}|FA\d{11}|LE\d{11}|"
    r"TA\d{11}|TC\d{11}|TN\d{11}|TR\d{11}|TP\d{11}|"
    r"(?:C|D|E|F|J)\d{11}"
    r")$"
)


def is_valid_tin(s: str) -> bool:
    """True iff `s` matches any documented LHDN TIN format (active or legacy).

    Whitespace stripped before match — TINs are sometimes printed with
    spaces between prefix and digits.
    """
    return TIN_ANY.match(re.sub(r"\s+", "", s.upper())) is not None


# ─── Diameter symbol normalization ───────────────────────────────────────────

# Engineering/manufacturing convention: ⌀ (U+2300 DIAMETER SIGN) is the
# canonical mark. OCR + DTP commonly substitute φ (Greek small phi) or
# Ø (Latin O with stroke) — normalize all to the canonical.
DIAMETER_NORMALIZE: Final = str.maketrans(
    {
        "φ": "⌀",  # GREEK SMALL LETTER PHI    → DIAMETER SIGN
        "Φ": "⌀",  # GREEK CAPITAL LETTER PHI  → DIAMETER SIGN
        "Ø": "⌀",  # LATIN CAPITAL LETTER O WITH STROKE → DIAMETER SIGN
        "ø": "⌀",  # LATIN SMALL LETTER O WITH STROKE   → DIAMETER SIGN
    }
)


def normalize_diameter(s: str) -> str:
    """Replace common diameter-sign substitutes with U+2300 ⌀."""
    return s.translate(DIAMETER_NORMALIZE)


# ─── ISO 8601 date hint (basic shape match, not parser) ──────────────────────

# Used by `anchors.py` to detect candidate date strings inside Chandra
# blocks before handing them to dateutil.parser. Loose by design — the
# parser does the real validation.
DATE_HINT: Final = re.compile(
    r"\b("
    r"\d{4}-\d{2}-\d{2}"  # ISO YYYY-MM-DD
    r"|\d{1,2}/\d{1,2}/\d{2,4}"  # DD/MM/YYYY or M/D/YY
    r"|\d{1,2}-\d{1,2}-\d{2,4}"  # DD-MM-YYYY
    r"|\d{1,2}\.\d{1,2}\.\d{2,4}"  # DD.MM.YYYY
    r")\b"
)
