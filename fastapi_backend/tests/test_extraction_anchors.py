"""Tier-1 + Tier-2 anchor extraction tests.

Synthetic Chandra-shaped block fixtures keep these tests fast and
deterministic. Real-fixture validation belongs in tests_eval/, not
here.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from app.services.extraction.anchors import extract_anchors

# ─── Helpers ─────────────────────────────────────────────────────────────────


def _text_block(
    html: str, *, page: int = 0, block_id: str = "/page/0/Text/0"
) -> dict[str, Any]:
    return {
        "id": block_id,
        "block_type": "Text",
        "html": html,
        "bbox": [10.0, 20.0, 100.0, 40.0],
        "page": page,
    }


def _table_block(
    html: str, *, page: int = 0, block_id: str = "/page/0/Table/0"
) -> dict[str, Any]:
    return {
        "id": block_id,
        "block_type": "Table",
        "html": html,
        "bbox": [10.0, 50.0, 200.0, 200.0],
        "page": page,
    }


# ─── Tier 1: label proximity ─────────────────────────────────────────────────


def test_label_proximity_extracts_weighing_no() -> None:
    blocks = [_text_block("<p>Weighing No: 202301011234</p>")]
    anchors = extract_anchors(blocks)
    assert len(anchors) == 1
    assert anchors[0].field == "weighing_no"
    assert anchors[0].value == "202301011234"
    assert anchors[0].source == "regex_label"


def test_label_proximity_validates_vehicle_plate() -> None:
    blocks = [_text_block("<p>Vehicle No: JWP 8186</p>")]
    anchors = extract_anchors(blocks)
    matches = [a for a in anchors if a.field == "vehicle_number"]
    assert len(matches) == 1
    assert matches[0].value == "JWP8186"  # normalized


def test_label_proximity_rejects_invalid_plate() -> None:
    """A label-anchored value that fails the plate regex is dropped, not
    promoted. Better no anchor than a wrong one. Test data deliberately
    chosen so no substring forms a valid regional plate."""
    blocks = [_text_block("<p>Vehicle No: nothing-here</p>")]
    anchors = extract_anchors(blocks)
    assert not any(a.field == "vehicle_number" for a in anchors)


def test_label_proximity_corrects_id_chars_with_doc_date() -> None:
    blocks = [_text_block("<p>P/O Number: LXSKJ202S001</p>")]
    anchors = extract_anchors(blocks, doc_date=date(2025, 11, 25))
    po = next(a for a in anchors if a.field == "po_number")
    assert po.value == "LXSKJ2025001"


def test_label_proximity_skips_id_correction_without_date() -> None:
    blocks = [_text_block("<p>P/O Number: LXSKJ202S001</p>")]
    anchors = extract_anchors(blocks, doc_date=None)
    po = next(a for a in anchors if a.field == "po_number")
    # No anchor → no correction; value stays uppercase but unchanged
    assert po.value == "LXSKJ202S001"


def test_label_proximity_carries_page_and_block_id() -> None:
    blocks = [
        _text_block(
            "<p>Vehicle No: JWP 8186</p>",
            page=2,
            block_id="/page/2/Text/5",
        )
    ]
    anchors = extract_anchors(blocks)
    a = next(x for x in anchors if x.field == "vehicle_number")
    assert a.block_id == "/page/2/Text/5"
    assert a.page == 3  # 0-indexed → 1-indexed
    assert a.bbox == (10.0, 20.0, 100.0, 40.0)


def test_label_proximity_finds_multiple_fields_in_one_block() -> None:
    html = (
        "<p>Weighing No: 202301011234<br/>Vehicle No: JWP 8186<br/>Date: 25/11/2025</p>"
    )
    blocks = [_text_block(html)]
    anchors = extract_anchors(blocks, doc_date=date(2025, 11, 25))
    fields = {a.field for a in anchors}
    assert {"weighing_no", "vehicle_number", "date"}.issubset(fields)


def test_label_proximity_lookahead_doesnt_bleed_to_next_field() -> None:
    """80-char window must be tight enough that 'Vehicle No: JWP 8186'
    and 'Material: Steel Bar' don't bleed into each other's anchors."""
    html = "<p>Vehicle No: JWP 8186 Material: Steel Bar B500B 16mm</p>"
    blocks = [_text_block(html)]
    anchors = extract_anchors(blocks)
    plates = [a for a in anchors if a.field == "vehicle_number"]
    assert len(plates) == 1
    assert plates[0].value == "JWP8186"


# ─── Tier 2: table column header ─────────────────────────────────────────────


def test_table_header_maps_columns_to_fields() -> None:
    html = """
    <table>
      <tr><th>Gross</th><th>Tare</th><th>Net</th></tr>
      <tr><td>42.40 t</td><td>14.20 t</td><td>28.20 t</td></tr>
    </table>
    """
    blocks = [_table_block(html)]
    anchors = extract_anchors(blocks)
    by_field = {a.field: a.value for a in anchors}
    assert by_field["gross_weight"] == "42.40 t"
    assert by_field["tare_weight"] == "14.20 t"
    assert by_field["net_weight"] == "28.20 t"
    assert all(a.source == "regex_table" for a in anchors)


def test_table_header_handles_th_in_first_row_via_td_fallback() -> None:
    """Some Chandra HTML uses <td> in the header row instead of <th>."""
    html = """
    <table>
      <tr><td>Vehicle</td><td>Quantity</td></tr>
      <tr><td>JWP 8186</td><td>10</td></tr>
    </table>
    """
    blocks = [_table_block(html)]
    anchors = extract_anchors(blocks)
    fields = [a.field for a in anchors]
    assert "vehicle_number" in fields


def test_table_header_emits_one_anchor_per_row() -> None:
    """Multi-row tables (line items) emit one anchor per row per mapped column."""
    html = """
    <table>
      <tr><th>Description</th><th>Quantity</th></tr>
      <tr><td>Steel Bar B500B 16mm</td><td>10</td></tr>
      <tr><td>Wire Mesh A6</td><td>5</td></tr>
    </table>
    """
    blocks = [_table_block(html)]
    anchors = extract_anchors(blocks)
    desc_anchors = [a for a in anchors if a.field == "items.description"]
    qty_anchors = [a for a in anchors if a.field == "items.quantity"]
    assert len(desc_anchors) == 2
    assert len(qty_anchors) == 2
    assert desc_anchors[0].value == "Steel Bar B500B 16mm"
    assert desc_anchors[1].value == "Wire Mesh A6"


def test_table_with_unmapped_headers_yields_no_anchors() -> None:
    """Headers that don't match any field hint are silently skipped."""
    html = """
    <table>
      <tr><th>Notes</th><th>Reference</th></tr>
      <tr><td>some note</td><td>ref-123</td></tr>
    </table>
    """
    blocks = [_table_block(html)]
    anchors = extract_anchors(blocks)
    assert anchors == []


def test_table_skips_invalid_plate_in_vehicle_column() -> None:
    html = """
    <table>
      <tr><th>Vehicle</th></tr>
      <tr><td>not-a-plate</td></tr>
    </table>
    """
    blocks = [_table_block(html)]
    anchors = extract_anchors(blocks)
    assert not any(a.field == "vehicle_number" for a in anchors)


# ─── Block-type filtering ────────────────────────────────────────────────────


def test_picture_blocks_are_skipped() -> None:
    blocks = [
        {
            "id": "/page/0/Picture/0",
            "block_type": "Picture",
            "html": "<img src='x'/>",
            "bbox": [0, 0, 10, 10],
            "page": 0,
        }
    ]
    anchors = extract_anchors(blocks)
    assert anchors == []


def test_section_header_blocks_are_scanned_for_labels() -> None:
    """SectionHeader blocks ('WEIGHING SLIP', etc) usually don't carry
    field labels — but the scanner shouldn't crash on them, and if a
    label happens to appear, it should be picked up."""
    blocks = [
        {
            "id": "/page/0/SectionHeader/0",
            "block_type": "SectionHeader",
            "html": "<h1>WEIGHING SLIP — Weighing No 202301011234</h1>",
            "bbox": [0, 0, 100, 30],
            "page": 0,
        }
    ]
    anchors = extract_anchors(blocks)
    assert any(a.field == "weighing_no" for a in anchors)


# ─── Combined Tier 1 + Tier 2 ────────────────────────────────────────────────


def test_label_and_table_can_both_anchor_same_field() -> None:
    """When a value appears in both a label-anchored block and a table,
    both anchors are emitted. The merge layer is responsible for
    deduplication; this module only collects evidence."""
    blocks = [
        _text_block(
            "<p>Vehicle No: JWP 8186</p>",
            block_id="/page/0/Text/0",
        ),
        _table_block(
            """
            <table>
              <tr><th>Vehicle</th></tr>
              <tr><td>JWP 8186</td></tr>
            </table>
            """,
            block_id="/page/0/Table/0",
        ),
    ]
    anchors = extract_anchors(blocks)
    plates = [a for a in anchors if a.field == "vehicle_number"]
    assert len(plates) == 2
    assert {p.source for p in plates} == {"regex_label", "regex_table"}


# ─── Edge cases ──────────────────────────────────────────────────────────────


def test_empty_blocks_list_returns_empty() -> None:
    assert extract_anchors([]) == []


def test_block_with_empty_html_yields_nothing() -> None:
    blocks = [_text_block("")]
    assert extract_anchors(blocks) == []


def test_block_without_bbox_returns_anchor_with_none_bbox() -> None:
    blocks = [
        {
            "id": "/page/0/Text/0",
            "block_type": "Text",
            "html": "<p>Weighing No: 202301011234</p>",
            "page": 0,
            # bbox missing
        }
    ]
    anchors = extract_anchors(blocks)
    assert len(anchors) == 1
    assert anchors[0].bbox is None


@pytest.mark.parametrize(
    "label_text",
    [
        "Vehicle No",
        "Vehicle Number",
        "vehicle no.",
        "Vehicle Plate",
        "Reg No",
        "Lori",
    ],
)
def test_vehicle_label_variants(label_text: str) -> None:
    blocks = [_text_block(f"<p>{label_text}: JWP 8186</p>")]
    anchors = extract_anchors(blocks)
    assert any(a.field == "vehicle_number" for a in anchors), label_text
