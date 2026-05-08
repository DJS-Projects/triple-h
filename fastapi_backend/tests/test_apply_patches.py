"""Unit tests for the pure patch applier."""

from __future__ import annotations

import pytest

from app.refinement.apply_patches import apply_patches
from app.refinement.schemas import BBox, BBoxPatch


SCAFFOLD = {
    "pages": {"1": {"size": {"width": 595.44, "height": 842.04}}},
    "texts": [
        {
            "self_ref": "f0",
            "text": "Lot 3387, Jalan Keretapi Lama,",
            "prov": [{"bbox": {"l": 62.33, "t": 35.29, "r": 171.33, "b": 52.96}}],
        },
        {
            "self_ref": "f37",
            "text": "Delivery Order No : DO-61581",
            "prov": [{"bbox": {"l": 401.67, "t": 40.67, "r": 530.67, "b": 51.33}}],
        },
        {
            "self_ref": "f17",
            "text": "SINTARI SDN BHD",
            "prov": [{"bbox": {"l": 172.67, "t": 718.33, "r": 487.67, "b": 750.67}}],
        },
    ],
}


def _patch(**kw: object) -> BBoxPatch:
    base = dict(reason="test", confidence=0.9)
    base.update(kw)  # type: ignore[arg-type]
    return BBoxPatch.model_validate(base)


def test_assign_writes_field_assignment() -> None:
    out = apply_patches(
        SCAFFOLD,
        [_patch(op="assign", fragment_id="f37", field_key="do_number")],
    )
    assert out["field_assignments"]["do_number"]["fragment_id"] == "f37"
    assert out["field_assignments"]["do_number"]["confidence"] == 0.9


def test_reject_records_fragment() -> None:
    out = apply_patches(
        SCAFFOLD,
        [_patch(op="reject", fragment_id="f17")],
    )
    assert any(r["fragment_id"] == "f17" for r in out["rejected_fragments"])


def test_low_confidence_patches_are_recorded_not_applied() -> None:
    out = apply_patches(
        SCAFFOLD,
        [_patch(op="assign", fragment_id="f37", field_key="do_number", confidence=0.2)],
    )
    assert "do_number" not in out["field_assignments"]
    assert len(out["low_confidence_patches"]) == 1


def test_orphan_fragment_id_recorded() -> None:
    out = apply_patches(
        SCAFFOLD,
        [_patch(op="assign", fragment_id="not_present", field_key="do_number")],
    )
    assert "do_number" not in out["field_assignments"]
    assert len(out["orphan_patches"]) == 1


def test_input_scaffold_not_mutated() -> None:
    apply_patches(
        SCAFFOLD,
        [_patch(op="assign", fragment_id="f37", field_key="do_number")],
    )
    # SCAFFOLD remains pristine — apply_patches deepcopies internally.
    assert "field_assignments" not in SCAFFOLD


def test_add_op_creates_new_fragment_with_box_2d() -> None:
    out = apply_patches(
        SCAFFOLD,
        [
            _patch(
                op="add",
                field_key="driver_signature",
                new_text="Hafizalashwat",
                # 1000-normalized bbox; with 595.44x842.04 page that's
                # left=59.544, top=84.204, right=119.088, bottom=126.306
                box_2d=[100, 100, 200, 150],
            )
        ],
    )
    assert len(out["added_fragments"]) == 1
    added = out["added_fragments"][0]
    assert added["text"] == "Hafizalashwat"
    assert added["field_key"] == "driver_signature"
    bbox = added["bbox"]
    assert bbox["l"] == pytest.approx(59.544, abs=1e-2)
    assert bbox["t"] == pytest.approx(84.204, abs=1e-2)
    # Field assignment surfaces alongside add
    assert out["field_assignments"]["driver_signature"]["fragment_id"].startswith(
        "#/refined-texts/"
    )


def test_move_op_replaces_bbox_and_records_history() -> None:
    out = apply_patches(
        SCAFFOLD,
        [
            _patch(
                op="move",
                fragment_id="f37",
                box_2d=[700, 50, 900, 80],
            )
        ],
    )
    assert len(out["bbox_history"]) == 1
    history = out["bbox_history"][0]
    assert history["fragment_id"] == "f37"
    assert history["before"] == {
        "l": 401.67,
        "t": 40.67,
        "r": 530.67,
        "b": 51.33,
    }
    # Fragment's prov[0].bbox should now reflect the new coords
    moved = next(t for t in out["texts"] if t["self_ref"] == "f37")
    assert moved["prov"][0]["bbox"]["l"] == pytest.approx(416.81, abs=1e-2)


def test_add_requires_text() -> None:
    with pytest.raises(ValueError, match="add requires new_text"):
        apply_patches(
            SCAFFOLD,
            [_patch(op="add", field_key="x", box_2d=[1, 2, 3, 4])],
        )


def test_move_requires_box() -> None:
    with pytest.raises(ValueError, match="requires box_2d or new_bbox"):
        apply_patches(
            SCAFFOLD,
            [_patch(op="move", fragment_id="f37")],
        )


def test_new_bbox_fallback_works() -> None:
    """new_bbox in PDF points should still work when box_2d absent."""
    out = apply_patches(
        SCAFFOLD,
        [
            _patch(
                op="add",
                field_key="x",
                new_text="hello",
                new_bbox=BBox(l=10, t=10, r=20, b=20),
            )
        ],
    )
    assert len(out["added_fragments"]) == 1
    assert out["added_fragments"][0]["bbox"]["l"] == 10
