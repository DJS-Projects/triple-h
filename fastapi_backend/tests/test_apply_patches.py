"""Unit tests for the pure patch applier."""

from __future__ import annotations

from app.refinement.apply_patches import apply_patches
from app.refinement.schemas import BBox, BBoxPatch


SCAFFOLD = {
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


def test_unsupported_ops_raise() -> None:
    import pytest

    with pytest.raises(NotImplementedError):
        apply_patches(
            SCAFFOLD,
            [
                _patch(
                    op="add",
                    field_key="signature",
                    new_text="signed",
                    new_bbox=BBox(l=10, t=10, r=20, b=20),
                )
            ],
        )

    with pytest.raises(NotImplementedError):
        apply_patches(
            SCAFFOLD,
            [
                _patch(
                    op="move",
                    fragment_id="f37",
                    new_bbox=BBox(l=10, t=10, r=20, b=20),
                )
            ],
        )
