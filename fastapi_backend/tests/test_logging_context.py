"""Smoke tests for structlog trace + extraction context processors.

Asserts that the two custom processors in `app.logging_setup` actually
attach trace_id/span_id (from OTel) and extraction_id/t_elapsed_ms (from
ContextVars) to every log event. If these regress, the entire
auditability story falls apart silently — anchor_match and arq_slot
events would still fire, just without the IDs that correlate them.
"""

from __future__ import annotations

import time

import pytest
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider

from app.logging_setup import (
    _extraction_context_processor,
    _trace_context_processor,
    extraction_id_var,
    langfuse_call_metadata,
    request_start_var,
)


@pytest.fixture(autouse=True)
def reset_contextvars():
    """Clear per-request ContextVars between tests so leakage doesn't mask bugs."""
    eid_token = extraction_id_var.set(None)
    start_token = request_start_var.set(None)
    yield
    extraction_id_var.reset(eid_token)
    request_start_var.reset(start_token)


@pytest.fixture(scope="module")
def tracer_provider():
    """In-memory tracer provider; never exports anywhere."""
    provider = TracerProvider(resource=Resource.create({"service.name": "test"}))
    trace.set_tracer_provider(provider)
    return provider


def test_trace_processor_no_active_span():
    """Outside any span, the processor adds nothing (no trace_id key)."""
    event = {"event": "test"}
    out = _trace_context_processor(None, "info", dict(event))
    assert "trace_id" not in out
    assert "span_id" not in out


def test_trace_processor_inside_span(tracer_provider):
    """Inside an active span, trace_id + span_id are hex-encoded into the event."""
    tracer = trace.get_tracer("test")
    with tracer.start_as_current_span("unit-test-span"):
        out = _trace_context_processor(None, "info", {"event": "test"})
    assert "trace_id" in out
    assert "span_id" in out
    assert len(out["trace_id"]) == 32  # 128-bit hex
    assert len(out["span_id"]) == 16  # 64-bit hex
    assert all(c in "0123456789abcdef" for c in out["trace_id"])


def test_extraction_processor_no_contextvar():
    """When ContextVars unset (background tasks, startup), processor adds nothing."""
    out = _extraction_context_processor(None, "info", {"event": "test"})
    assert "extraction_id" not in out
    assert "t_elapsed_ms" not in out


def test_extraction_processor_with_contextvar():
    """With ContextVars set, extraction_id + t_elapsed_ms land on the event."""
    extraction_id_var.set("abc123")
    request_start_var.set(time.perf_counter())
    out = _extraction_context_processor(None, "info", {"event": "test"})
    assert out["extraction_id"] == "abc123"
    assert isinstance(out["t_elapsed_ms"], float)
    assert out["t_elapsed_ms"] >= 0.0


def test_processors_compose(tracer_provider):
    """Both processors stack — single event carries all four fields."""
    extraction_id_var.set("xyz789")
    request_start_var.set(time.perf_counter())
    tracer = trace.get_tracer("test")
    with tracer.start_as_current_span("compose-test"):
        event: dict = {"event": "anchor_match", "field": "vehicle_number"}
        event = _trace_context_processor(None, "info", event)
        event = _extraction_context_processor(None, "info", event)

    assert event["field"] == "vehicle_number"
    assert event["extraction_id"] == "xyz789"
    assert "trace_id" in event
    assert "span_id" in event
    assert "t_elapsed_ms" in event


def test_langfuse_metadata_no_extraction_id():
    """No request scope → empty dict; LiteLLM falls back to per-call traces."""
    assert langfuse_call_metadata(filename="x.pdf", purpose="classify") == {}


def test_langfuse_metadata_full():
    """All call params present → trace_id, name, session_id, tags populated."""
    extraction_id_var.set("a1b2c3d4e5f6")
    meta = langfuse_call_metadata(
        filename="arfi_8038.pdf",
        doc_type="invoice",
        model="ollama-gemma4-31b",
        purpose="arq_extract",
    )
    assert meta["trace_id"] == "a1b2c3d4e5f6"
    assert meta["session_id"] == "a1b2c3d4e5f6"
    assert meta["trace_name"] == "arq_extract:arfi_8038.pdf"
    assert set(meta["tags"]) == {"invoice", "ollama-gemma4-31b", "arq_extract"}


def test_langfuse_metadata_partial():
    """Missing fields are skipped from tags / name without crashing."""
    extraction_id_var.set("zzz")
    meta = langfuse_call_metadata(filename="x.pdf")
    assert meta["trace_id"] == "zzz"
    assert meta["trace_name"] == "x.pdf"
    assert meta["tags"] == []
