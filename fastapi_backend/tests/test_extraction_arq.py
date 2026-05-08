"""Tests for per-doc-type ARQ wrapper schemas.

The critical contract these tests pin is **field declaration order** —
ARQ relies on autoregressive decoding generating the leading reasoning
slots before the typed `extracted` payload. Reordering breaks the
recency-effect mechanism the paper relies on.
"""

from __future__ import annotations

import pytest
from pydantic import BaseModel

from app.services.extraction.arq import (
    ARQ_BY_DOC_TYPE,
    DeliveryOrderARQ,
    InvoiceARQ,
    PetrolBillARQ,
    WeighingBillARQ,
)


_EXPECTED_LEADING_ORDER = ["visual_audit", "field_grounding", "id_code_audit"]


@pytest.mark.parametrize(
    "model_cls",
    [DeliveryOrderARQ, WeighingBillARQ, InvoiceARQ, PetrolBillARQ],
)
def test_arq_schemas_have_leading_slots_first_then_extracted(
    model_cls: type[BaseModel],
) -> None:
    """Field declaration order is the load-bearing contract: reasoning
    slots must precede the typed extracted payload so they get
    completed first by the autoregressive LLM."""
    fields = list(model_cls.model_fields.keys())
    assert fields[:3] == _EXPECTED_LEADING_ORDER
    assert fields[3] == "extracted"
    assert len(fields) == 4


def test_arq_lookup_covers_all_doc_types() -> None:
    """Every supported DocType must have an ARQ wrapper."""
    expected = {"delivery_order", "weighing_bill", "invoice", "petrol_bill"}
    assert set(ARQ_BY_DOC_TYPE.keys()) == expected


@pytest.mark.parametrize(
    "doc_type,expected_cls",
    [
        ("delivery_order", DeliveryOrderARQ),
        ("weighing_bill", WeighingBillARQ),
        ("invoice", InvoiceARQ),
        ("petrol_bill", PetrolBillARQ),
    ],
)
def test_arq_lookup_returns_correct_wrapper(
    doc_type: str, expected_cls: type[BaseModel]
) -> None:
    assert ARQ_BY_DOC_TYPE[doc_type] is expected_cls


def test_arq_round_trip_with_minimal_payload() -> None:
    """Construct a full ARQ envelope with the minimum required fields
    and verify it survives a JSON round-trip — the wire shape we'd
    actually emit from the LLM."""
    arq = WeighingBillARQ(
        visual_audit="Top-left letterhead reads ALLIANCE STEEL. Center "
        "table with three weight columns. Bottom-right stamp partially "
        "obscured. Vehicle plate visible in inset photo. Handwritten "
        "remark in margin.",
        field_grounding="weighing_no anchor confirmed. vehicle_no anchor "
        "confirmed. gross_weight, tare_weight, net_weight in center "
        "table. material_name NOT PRESENT.",
        id_code_audit="none",
        extracted={  # type: ignore[arg-type]
            "weighing_no": "202301011234",
            "vehicle_no": "JWP8186",
            "gross_weight": "42.40 t",
        },
    )

    raw = arq.model_dump_json()
    restored = WeighingBillARQ.model_validate_json(raw)
    # Critical: round-trip preserves field order in the JSON output.
    assert restored == arq


def test_arq_extra_fields_rejected() -> None:
    """extra='forbid' on every wrapper — schema drift caught at parse
    time. If the LLM emits a key we didn't ask for, validation fails
    and we know to either add the field or fix the prompt."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        DeliveryOrderARQ.model_validate(
            {
                "visual_audit": "x",
                "field_grounding": "y",
                "id_code_audit": "z",
                "extracted": {},
                "unexpected_extra_slot": "should fail",
            }
        )


def test_arq_descriptions_mention_recency_constraint() -> None:
    """Field descriptions feed pydantic-ai into the prompt. The
    visual_audit description must instruct the model to skip OCR
    consultation, otherwise scaffold-bias kicks in and the slot's
    purpose is defeated."""
    desc = WeighingBillARQ.model_fields["visual_audit"].description or ""
    assert "WITHOUT" in desc.upper()
    assert "ocr" in desc.lower()
