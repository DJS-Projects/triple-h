"""Round-trip tests for the extraction envelope schema.

The envelope is the contract every pipeline stage agrees on. Tests pin
the shape so reorderings, renamings, or accidental relaxations of
extra=forbid get caught at PR time, not in production.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.services.extraction.result import (
    DocumentAnalysis,
    ExtractionEnvelope,
    ExtractionMetadata,
    FieldProvenance,
    StageOutput,
    TokenUsage,
)


# ─── FieldProvenance ─────────────────────────────────────────────────────────


def test_field_provenance_minimal_regex_anchor() -> None:
    p = FieldProvenance(field="weighing_no", value="202301011234", source="regex_label")
    assert p.block_id is None
    assert p.bbox is None
    assert p.confidence is None


def test_field_provenance_with_bbox_and_page() -> None:
    p = FieldProvenance(
        field="vehicle_no",
        value="JWP8186",
        source="regex_table",
        block_id="/page/0/Table/0",
        bbox=(120.5, 340.0, 280.0, 365.5),
        page=1,
        confidence=1.0,
    )
    assert p.bbox == (120.5, 340.0, 280.0, 365.5)
    assert p.page == 1


def test_field_provenance_rejects_unknown_source() -> None:
    with pytest.raises(ValidationError):
        FieldProvenance(field="x", value="y", source="not_a_source")


def test_field_provenance_confidence_bounds() -> None:
    # 0 and 1 are valid endpoints; outside is not.
    FieldProvenance(field="x", value="y", source="vlm", confidence=0.0)
    FieldProvenance(field="x", value="y", source="vlm", confidence=1.0)
    with pytest.raises(ValidationError):
        FieldProvenance(field="x", value="y", source="vlm", confidence=1.01)
    with pytest.raises(ValidationError):
        FieldProvenance(field="x", value="y", source="vlm", confidence=-0.01)


def test_field_provenance_is_frozen() -> None:
    p = FieldProvenance(field="x", value="y", source="vlm")
    with pytest.raises(ValidationError):
        p.field = "z"  # type: ignore[misc]


# ─── StageOutput ─────────────────────────────────────────────────────────────


def test_stage_output_minimal() -> None:
    s = StageOutput(parsed_info={"weighing_no": "202301011234"}, duration_ms=12)
    assert s.fields_filled == []
    assert s.missing_fields == []


def test_stage_output_diffable_across_stages() -> None:
    chandra = StageOutput(
        parsed_info={"weighing_no": "202301011234", "vehicle_no": "JWP8186"},
        fields_filled=["weighing_no", "vehicle_no"],
        missing_fields=["material_name", "deliver", "receiver"],
        duration_ms=8,
    )
    vlm = StageOutput(
        parsed_info={
            "weighing_no": "202301011234",
            "vehicle_no": "JWP8186",
            "material_name": "Steel Bar B500B 16mm",
            "deliver": "Alliance Steel",
            "receiver": "GBI Mesh & Bar Trading",
        },
        fields_filled=[
            "weighing_no",
            "vehicle_no",
            "material_name",
            "deliver",
            "receiver",
        ],
        missing_fields=[],
        duration_ms=4231,
    )
    # Both stages present the same key shape; merge layer is responsible
    # for picking values per field.
    assert set(chandra.parsed_info) <= set(vlm.parsed_info)


def test_stage_output_rejects_negative_duration() -> None:
    with pytest.raises(ValidationError):
        StageOutput(parsed_info={}, duration_ms=-1)


# ─── DocumentAnalysis ────────────────────────────────────────────────────────


def test_document_analysis_single_doc_mode() -> None:
    a = DocumentAnalysis(detected_type="weighing_bill")
    assert a.detected_types == []
    assert a.pages_breakdown == {}
    assert a.issuer_canonical is None


def test_document_analysis_mixed_doc_mode_future() -> None:
    a = DocumentAnalysis(
        detected_type="delivery_order",
        detected_types=["delivery_order", "weighing_bill"],
        pages_breakdown={1: "delivery_order", 2: "weighing_bill"},
        issuer_canonical="Alliance Steel (M) Sdn. Bhd.",
    )
    assert a.pages_breakdown[2] == "weighing_bill"


def test_document_analysis_rejects_unknown_doc_type() -> None:
    with pytest.raises(ValidationError):
        DocumentAnalysis(detected_type="not_a_doc_type")  # type: ignore[arg-type]


# ─── ExtractionMetadata ──────────────────────────────────────────────────────


def test_metadata_minimal() -> None:
    m = ExtractionMetadata(vlm_model="gemma-4-31b", processing_time_ms=4321)
    assert m.ocr_provider == "chandra"
    assert m.token_usage is None


def test_metadata_with_token_usage() -> None:
    m = ExtractionMetadata(
        vlm_model="gemma-4-31b",
        processing_time_ms=1000,
        token_usage=TokenUsage(
            prompt_tokens=1200, completion_tokens=380, total_tokens=1580
        ),
    )
    assert m.token_usage is not None
    assert m.token_usage.total_tokens == 1580


# ─── ExtractionEnvelope (top-level) ──────────────────────────────────────────


def test_envelope_round_trip_ok_status() -> None:
    env = ExtractionEnvelope(
        status="ok",
        doc_type="weighing_bill",
        parsed_info={
            "weighing_no": "202301011234",
            "vehicle_no": "JWP8186",
            "gross_weight": "42.40 t",
            "tare_weight": "14.20 t",
            "net_weight": "28.20 t",
        },
        provenance=[
            FieldProvenance(
                field="weighing_no",
                value="202301011234",
                source="regex_label",
                block_id="/page/0/Text/0",
                page=1,
                confidence=1.0,
            ),
            FieldProvenance(
                field="vehicle_no",
                value="JWP8186",
                source="regex_label",
                block_id="/page/0/Text/1",
                page=1,
                confidence=1.0,
            ),
        ],
        stage_outputs={
            "chandra_processed": StageOutput(
                parsed_info={
                    "weighing_no": "202301011234",
                    "vehicle_no": "JWP8186",
                },
                fields_filled=["weighing_no", "vehicle_no"],
                missing_fields=["gross_weight", "tare_weight", "net_weight"],
                duration_ms=8,
            ),
            "vlm_processed": StageOutput(
                parsed_info={
                    "weighing_no": "202301011234",
                    "vehicle_no": "JWP8186",
                    "gross_weight": "42.40 t",
                    "tare_weight": "14.20 t",
                    "net_weight": "28.20 t",
                },
                fields_filled=[
                    "weighing_no",
                    "vehicle_no",
                    "gross_weight",
                    "tare_weight",
                    "net_weight",
                ],
                missing_fields=[],
                duration_ms=4231,
            ),
        },
        document_analysis=DocumentAnalysis(detected_type="weighing_bill"),
        metadata=ExtractionMetadata(vlm_model="gemma-4-31b", processing_time_ms=4239),
    )

    # Round-trip via JSON to confirm pydantic serializes/deserializes cleanly.
    raw = env.model_dump_json()
    restored = ExtractionEnvelope.model_validate_json(raw)
    assert restored == env


def test_envelope_partial_status_when_one_stage_only() -> None:
    """`status: partial` is the documented contract for VLM-down or
    Chandra-down fallback paths."""
    env = ExtractionEnvelope(
        status="partial",
        doc_type="weighing_bill",
        parsed_info={"weighing_no": "202301011234"},
        provenance=[
            FieldProvenance(
                field="weighing_no",
                value="202301011234",
                source="regex_label",
            )
        ],
        stage_outputs={
            "chandra_processed": StageOutput(
                parsed_info={"weighing_no": "202301011234"},
                fields_filled=["weighing_no"],
                duration_ms=12,
            ),
            # vlm_processed deliberately absent — represents VLM failure.
        },
        document_analysis=DocumentAnalysis(detected_type="weighing_bill"),
        metadata=ExtractionMetadata(vlm_model="gemma-4-31b", processing_time_ms=12),
    )
    assert env.status == "partial"
    assert "vlm_processed" not in env.stage_outputs


def test_envelope_rejects_extra_keys() -> None:
    """extra='forbid' is the whole point — schema drift caught at parse time."""
    with pytest.raises(ValidationError):
        ExtractionEnvelope.model_validate(
            {
                "status": "ok",
                "doc_type": "weighing_bill",
                "parsed_info": {},
                "document_analysis": {"detected_type": "weighing_bill"},
                "metadata": {"vlm_model": "gemma-4-31b", "processing_time_ms": 0},
                "unknown_top_level_key": "should fail",
            }
        )
