"""Unit tests for ARQ-path helpers added in T9 wiring.

Covers the three deterministic helpers in `pipeline.py` that don't need
a real LLM / Chandra call to verify:

- `_format_anchors_for_prompt` — line-per-anchor prompt block
- `_dedupe_anchors` — collapse duplicate (field, value) entries
- `_build_envelope` — assemble ExtractionEnvelope from anchors + LLM output

End-to-end pipeline coverage (Chandra → render → ARQ → envelope) lives
in the eval suite (T12). That path needs real PDFs + a working LLM, which
is integration territory rather than unit territory.
"""

from __future__ import annotations

from app.services.extraction.pipeline import (
    _build_envelope,
    _dedupe_anchors,
    _format_anchors_for_prompt,
)
from app.services.extraction.result import FieldProvenance


# ─── _format_anchors_for_prompt ──────────────────────────────────────────────


def test_format_anchors_empty_returns_empty_string() -> None:
    """No anchors → empty string so callers can concatenate unconditionally."""
    assert _format_anchors_for_prompt([]) == ""


def test_format_anchors_single_anchor_renders_label_value_source_page() -> None:
    """One-anchor block must include field, quoted value, source, and page."""
    anchors = [
        FieldProvenance(
            field="do_number",
            value="DO12345",
            source="regex_label",
            page=1,
            confidence=1.0,
        )
    ]
    out = _format_anchors_for_prompt(anchors)
    assert "PRE-VALIDATED ANCHORS" in out
    assert 'do_number = "DO12345"' in out
    assert "regex_label" in out
    assert "page 1" in out
    assert "Confirm these verbatim" in out


def test_format_anchors_omits_page_when_unknown() -> None:
    """page=None must drop the page suffix entirely (not render 'page None')."""
    anchors = [
        FieldProvenance(
            field="vehicle_number",
            value="JWP8186",
            source="regex_table",
            page=None,
            confidence=1.0,
        )
    ]
    out = _format_anchors_for_prompt(anchors)
    assert 'vehicle_number = "JWP8186"' in out
    assert "page" not in out.split("\n")[1]  # the anchor line, not the header


def test_format_anchors_one_line_per_anchor() -> None:
    """Header + one line per anchor + trailer = N+2 lines for N anchors."""
    anchors = [
        FieldProvenance(field="a", value="1", source="regex_label", confidence=1.0),
        FieldProvenance(field="b", value="2", source="regex_table", confidence=1.0),
        FieldProvenance(field="c", value="3", source="regex_label", confidence=1.0),
    ]
    out = _format_anchors_for_prompt(anchors)
    assert len(out.split("\n")) == 5  # header + 3 anchors + trailer


# ─── _dedupe_anchors ─────────────────────────────────────────────────────────


def test_dedupe_keeps_first_occurrence_of_duplicate() -> None:
    """Duplicate (field, value) pairs collapse to the first occurrence."""
    label = FieldProvenance(
        field="do_number",
        value="DO12345",
        source="regex_label",
        confidence=1.0,
    )
    table = FieldProvenance(
        field="do_number",
        value="DO12345",
        source="regex_table",
        confidence=1.0,
    )
    out = _dedupe_anchors([label, table])
    assert len(out) == 1
    assert out[0].source == "regex_label"  # first occurrence wins


def test_dedupe_preserves_distinct_values_for_same_field() -> None:
    """Same field with different values → both kept (let LLM disambiguate)."""
    a = FieldProvenance(
        field="do_number", value="DO12345", source="regex_label", confidence=1.0
    )
    b = FieldProvenance(
        field="do_number", value="DO99999", source="regex_table", confidence=1.0
    )
    out = _dedupe_anchors([a, b])
    assert len(out) == 2


def test_dedupe_preserves_order() -> None:
    """Output order matches first-occurrence order — important for reproducible
    prompt rendering."""
    anchors = [
        FieldProvenance(field="z", value="1", source="regex_label", confidence=1.0),
        FieldProvenance(field="a", value="2", source="regex_label", confidence=1.0),
        FieldProvenance(field="m", value="3", source="regex_label", confidence=1.0),
        FieldProvenance(field="z", value="1", source="regex_table", confidence=1.0),
    ]
    out = _dedupe_anchors(anchors)
    assert [a.field for a in out] == ["z", "a", "m"]


# ─── _build_envelope ─────────────────────────────────────────────────────────


def test_build_envelope_attaches_vlm_provenance_for_unanchored_fields() -> None:
    """Every populated parsed_info field must have at least one provenance row.
    Anchored fields keep their regex_* provenance; un-anchored fields get a
    synthetic vlm row."""
    anchors = [
        FieldProvenance(
            field="do_number",
            value="DO12345",
            source="regex_label",
            confidence=1.0,
        )
    ]
    parsed = {
        "do_number": "DO12345",
        "supplier": "ALLIANCE STEEL",
        "total_mt": "5.0000",
    }
    env = _build_envelope(
        doc_type="delivery_order",
        model="ollama-gemma4-31b",
        page_count=1,
        checkpoint_id=None,
        parsed_info=parsed,
        anchors=anchors,
        chandra_duration_ms=1200,
        llm_duration_ms=8500,
        total_duration_ms=10000,
    )
    sources = {p.field: p.source for p in env.provenance}
    assert sources == {
        "do_number": "regex_label",
        "supplier": "vlm",
        "total_mt": "vlm",
    }


def test_build_envelope_stage_outputs_split_anchored_vs_llm() -> None:
    """chandra_processed.parsed_info contains anchor values; vlm_processed
    contains the full LLM output."""
    anchors = [
        FieldProvenance(
            field="do_number",
            value="DO12345",
            source="regex_label",
            confidence=1.0,
        )
    ]
    parsed = {"do_number": "DO12345", "supplier": "X"}
    env = _build_envelope(
        doc_type="delivery_order",
        model="m",
        page_count=1,
        checkpoint_id=None,
        parsed_info=parsed,
        anchors=anchors,
        chandra_duration_ms=100,
        llm_duration_ms=200,
        total_duration_ms=300,
    )
    chandra_stage = env.stage_outputs["chandra_processed"]
    vlm_stage = env.stage_outputs["vlm_processed"]
    assert chandra_stage.parsed_info == {"do_number": "DO12345"}
    assert chandra_stage.fields_filled == ["do_number"]
    assert chandra_stage.duration_ms == 100
    assert vlm_stage.parsed_info == parsed
    assert "do_number" in vlm_stage.fields_filled
    assert "supplier" in vlm_stage.fields_filled
    assert vlm_stage.duration_ms == 200


def test_build_envelope_excludes_empty_values_from_populated() -> None:
    """None / empty-string / empty-list parsed_info values must NOT count as
    populated — otherwise we'd emit vlm provenance rows for unfilled fields."""
    anchors: list[FieldProvenance] = []
    parsed = {
        "do_number": "DO12345",
        "supplier": "",
        "items": [],
        "remarks": None,
    }
    env = _build_envelope(
        doc_type="delivery_order",
        model="m",
        page_count=1,
        checkpoint_id=None,
        parsed_info=parsed,
        anchors=anchors,
        chandra_duration_ms=100,
        llm_duration_ms=200,
        total_duration_ms=300,
    )
    fields = [p.field for p in env.provenance]
    assert fields == ["do_number"]


def test_build_envelope_metadata_carries_model_and_timing() -> None:
    """Metadata block must round-trip the model id and total processing time —
    this is what eval and persistence read for run lineage."""
    env = _build_envelope(
        doc_type="weighing_bill",
        model="ollama-gemma4-31b",
        page_count=2,
        checkpoint_id="ckpt-abc",
        parsed_info={"gross_weight": "10.0000"},
        anchors=[],
        chandra_duration_ms=500,
        llm_duration_ms=4500,
        total_duration_ms=5200,
    )
    assert env.metadata.vlm_model == "ollama-gemma4-31b"
    assert env.metadata.page_count == 2
    assert env.metadata.chandra_checkpoint_id == "ckpt-abc"
    assert env.metadata.processing_time_ms == 5200
    assert env.document_analysis.detected_type == "weighing_bill"
