"""Tests for `field_pages_from_envelope` — the ARQ-envelope authoritative
path that replaces the v1 `compute_field_pages` substring heuristic on
ARQ runs.

The legacy substring path (`compute_field_anchors` / `compute_field_pages`)
is exercised in test_field_anchors.py if it exists; this module covers
only the new envelope-driven function.
"""

from __future__ import annotations

from app.services.field_anchors import (
    field_anchors_from_envelope,
    field_pages_from_envelope,
)


def test_field_pages_from_envelope_extracts_top_level_scalars() -> None:
    """Envelope with three top-level scalars → dict has all three with the
    correct page numbers. The 1-indexed page is preserved verbatim."""
    envelope = {
        "provenance": [
            {"field": "do_number", "value": "DO-61581", "page": 1},
            {"field": "po_number", "value": "PO2511-102", "page": 1},
            {"field": "vehicle_number", "value": "JWP8186", "page": 2},
        ]
    }
    result = field_pages_from_envelope(envelope)
    assert result == {"do_number": 1, "po_number": 1, "vehicle_number": 2}


def test_field_pages_from_envelope_handles_items_notation() -> None:
    """Item-row provenance arrives in FE-flattened form (`items[i].field`).
    The function must pass it through unchanged — no notation translation
    or filtering."""
    envelope = {
        "provenance": [
            {"field": "items[0].description", "value": "HTD BARS Y10", "page": 1},
            {"field": "items[1].description", "value": "HTD BARS Y12", "page": 1},
            {"field": "items[2].weight_mt", "value": "10.0000", "page": 1},
        ]
    }
    result = field_pages_from_envelope(envelope)
    assert result == {
        "items[0].description": 1,
        "items[1].description": 1,
        "items[2].weight_mt": 1,
    }


def test_field_pages_from_envelope_skips_entries_without_page() -> None:
    """vlm-source synthetic rows often have `page=None` (no anchor → no
    block_id → no derivable page). These must be omitted so the FE renders
    them as document-level — matches v1 semantics."""
    envelope = {
        "provenance": [
            {"field": "do_number", "value": "DO-61581", "page": 1},
            {"field": "total_quantity", "value": "25", "page": None},
            {"field": "total_weight_mt", "value": "25.0000", "page": None},
        ]
    }
    result = field_pages_from_envelope(envelope)
    assert result == {"do_number": 1}


def test_field_pages_from_envelope_empty_provenance_returns_empty() -> None:
    """Envelope shape with an empty provenance list → empty dict, not error."""
    assert field_pages_from_envelope({"provenance": []}) == {}


def test_field_pages_from_envelope_missing_provenance_key_returns_empty() -> None:
    """Robustness: a malformed envelope missing the `provenance` key (or with
    null) shouldn't raise — return empty dict."""
    assert field_pages_from_envelope({}) == {}
    assert field_pages_from_envelope({"provenance": None}) == {}


def test_field_pages_from_envelope_skips_entries_without_field() -> None:
    """Defensive: provenance entries lacking a `field` key are ignored rather
    than producing a {None: page} entry that would break FE map lookups."""
    envelope = {
        "provenance": [
            {"value": "DO-61581", "page": 1},  # no field key
            {"field": "do_number", "value": "DO-61581", "page": 1},
        ]
    }
    assert field_pages_from_envelope(envelope) == {"do_number": 1}


# ─── field_anchors_from_envelope ────────────────────────────────────────────


def test_field_anchors_from_envelope_returns_block_id_per_field() -> None:
    """Envelope entries with block_id → output {field: block_id}.
    Surfaces the per-page blue-dot + bbox-highlight contract."""
    envelope = {
        "provenance": [
            {
                "field": "do_number",
                "value": "DO-61581",
                "page": 1,
                "block_id": "/page/0/Text/1",
            },
            {
                "field": "po_number",
                "value": "PO2511-102",
                "page": 1,
                "block_id": "/page/0/Text/2",
            },
        ]
    }
    assert field_anchors_from_envelope(envelope) == {
        "do_number": "/page/0/Text/1",
        "po_number": "/page/0/Text/2",
    }


def test_field_anchors_from_envelope_skips_entries_without_block_id() -> None:
    """vlm-source rows lack block_id (no anchor → no target block).
    They must be excluded — otherwise FE maps to undefined blocks and
    blue-dot hover highlights nothing."""
    envelope = {
        "provenance": [
            {"field": "do_number", "page": 1, "block_id": "/page/0/Text/1"},
            {"field": "sold_to", "page": None, "block_id": None},
        ]
    }
    assert field_anchors_from_envelope(envelope) == {"do_number": "/page/0/Text/1"}


def test_field_anchors_from_envelope_filters_by_page_when_requested() -> None:
    """`page_no=N` (1-indexed) → only entries whose `page` matches N.
    Mirrors `compute_field_anchors`'s page filter so the per-page blocks
    route gets the same shape from both sources."""
    envelope = {
        "provenance": [
            {"field": "do_number", "page": 1, "block_id": "/page/0/Text/1"},
            {"field": "po_number", "page": 2, "block_id": "/page/1/Text/3"},
        ]
    }
    assert field_anchors_from_envelope(envelope, page_no=1) == {
        "do_number": "/page/0/Text/1"
    }
    assert field_anchors_from_envelope(envelope, page_no=2) == {
        "po_number": "/page/1/Text/3"
    }
    assert field_anchors_from_envelope(envelope, page_no=99) == {}


def test_field_anchors_from_envelope_no_page_filter_returns_all() -> None:
    """`page_no=None` (default) → no filtering, returns every entry with
    a block_id regardless of page. Used by callers that aggregate across
    the whole document."""
    envelope = {
        "provenance": [
            {"field": "do_number", "page": 1, "block_id": "/page/0/Text/1"},
            {"field": "po_number", "page": 2, "block_id": "/page/1/Text/3"},
        ]
    }
    assert field_anchors_from_envelope(envelope) == {
        "do_number": "/page/0/Text/1",
        "po_number": "/page/1/Text/3",
    }


def test_field_anchors_from_envelope_empty_provenance_returns_empty() -> None:
    """Robustness: missing or empty provenance → empty dict, not error."""
    assert field_anchors_from_envelope({}) == {}
    assert field_anchors_from_envelope({"provenance": []}) == {}
    assert field_anchors_from_envelope({"provenance": None}) == {}
