"""Tests for the post-extraction validate/correct loop.

The correctors module relies on a real LLM agent for the actual
correction call. These tests monkey-patch the agent factory so we can
verify the registry, retry logic, fall-through policy, and audit-log
shape without spending tokens or 30s per test.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.services.extraction import correctors
from app.services.extraction.correctors import (
    _registered_validators,
    correct_invalid_fields,
)


# ─── Helpers ─────────────────────────────────────────────────────────────────


class _FakeRunOutput:
    """Mimics pydantic-ai's run.output.value/.reasoning shape."""

    def __init__(self, value: str | None, reasoning: str = "test reasoning"):
        self.value = value
        self.reasoning = reasoning


class _FakeRun:
    def __init__(self, value: str | None, reasoning: str = "test"):
        self.output = _FakeRunOutput(value, reasoning)


def _agent_returning(*responses: str | None) -> Any:
    """Build a fake agent that returns the given responses in order on .run()."""
    iterator = iter(responses)

    async def _run(_message: Any) -> _FakeRun:
        try:
            return _FakeRun(next(iterator))
        except StopIteration:
            return _FakeRun(None, "ran out of fake responses")

    fake = AsyncMock()
    fake.run = _run
    return fake


@pytest.fixture
def patch_agent(
    monkeypatch: pytest.MonkeyPatch,
) -> Callable[..., None]:
    """Returns a function that installs a fake agent into _build_correction_agent."""

    def _install(*responses: str | None) -> None:
        fake = _agent_returning(*responses)
        monkeypatch.setattr(correctors, "_build_correction_agent", lambda _model: fake)

    return _install


# ─── Registry sanity ─────────────────────────────────────────────────────────


def test_registry_covers_expected_field_combinations() -> None:
    """The registry must include the four format types the user signed off on:
    plates, TINs, dates, postcodes — across delivery_order / weighing_bill /
    invoice / petrol_bill doc-types."""
    keys = set(_registered_validators().keys())
    assert ("delivery_order", "vehicle_number") in keys
    assert ("weighing_bill", "vehicle_no") in keys
    assert ("invoice", "bill_to_tin") in keys
    assert ("invoice", "from_tin") in keys
    assert ("invoice", "invoice_date") in keys
    assert ("delivery_order", "date") in keys


def test_registry_does_not_cover_internal_id_codes() -> None:
    """ID code fields (do_number, po_number, weighing_no, contract_no) have
    no public format spec — they MUST stay out of the registry, otherwise
    every customer-internal code triggers retries."""
    id_code_fields = {"do_number", "po_number", "weighing_no", "contract_no"}
    for (_doc_type, field_key), _ in _registered_validators().items():
        assert field_key not in id_code_fields, (
            f"Field {field_key!r} should not be in correctors registry — "
            "ID codes are customer-internal with no canonical format."
        )


# ─── Validation-only path (no LLM calls when everything passes) ──────────────


@pytest.mark.asyncio
async def test_no_corrections_when_all_fields_valid(patch_agent: Any) -> None:
    """Valid plates skip the correction loop entirely — no LLM calls, empty audit."""
    patch_agent()  # any agent call would StopIteration → None
    result = await correct_invalid_fields(
        parsed_info={"vehicle_number": ["WXY1234"]},
        doc_type="delivery_order",
        page_images=[],  # not consulted — no corrections needed
        model="m",
    )
    assert result.parsed_info == {"vehicle_number": ["WXY1234"]}
    assert result.corrections == []


@pytest.mark.asyncio
async def test_skips_fields_not_in_registry(patch_agent: Any) -> None:
    """Fields without a registered validator pass through untouched."""
    patch_agent()
    result = await correct_invalid_fields(
        parsed_info={"do_issuer_name": "GARBAGE \\\\ /// VALUE"},
        doc_type="delivery_order",
        page_images=[],
        model="m",
    )
    assert result.parsed_info == {"do_issuer_name": "GARBAGE \\\\ /// VALUE"}
    assert result.corrections == []


@pytest.mark.asyncio
async def test_skips_empty_values(patch_agent: Any) -> None:
    """None / empty string / empty list skip validation — no entry in audit log
    (the run had nothing to correct, not a failed correction)."""
    patch_agent()
    result = await correct_invalid_fields(
        parsed_info={"vehicle_number": [], "date": None},
        doc_type="delivery_order",
        page_images=[],
        model="m",
    )
    assert result.corrections == []


# ─── Successful correction path ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_invalid_plate_corrected_on_first_retry(patch_agent: Any) -> None:
    """LLM returns a valid plate on the first call → final value updated,
    correction audit row marks was_corrected=True, final_valid=True."""
    patch_agent("JHU8805")  # corrects "YHU/805" → "JHU8805"
    result = await correct_invalid_fields(
        parsed_info={"vehicle_number": ["YHU/805"]},
        doc_type="delivery_order",
        page_images=["fake-image-payload"],  # truthy = corrections enabled
        model="m",
    )
    assert result.parsed_info == {"vehicle_number": ["JHU8805"]}
    assert len(result.corrections) == 1
    c = result.corrections[0]
    assert c.field_path == "vehicle_number[0]"
    assert c.original_value == "YHU/805"
    assert c.final_value == "JHU8805"
    assert c.was_corrected is True
    assert c.final_valid is True
    assert c.retries_used == 0


# ─── Fall-through (retry exhaustion) ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_falls_through_when_llm_keeps_returning_invalid(
    patch_agent: Any,
) -> None:
    """LLM proposes invalid values across all retries → original kept, marked
    final_valid=False per the strict-but-tolerant policy."""
    # 1 first try + 1 retry = 2 attempts total (max_retries_per_field=1)
    patch_agent("STILL_BAD/123", "STILL_BAD/456")
    result = await correct_invalid_fields(
        parsed_info={"vehicle_number": ["YHU/805"]},
        doc_type="delivery_order",
        page_images=["fake-image"],
        model="m",
        max_retries_per_field=1,
    )
    # Original preserved.
    assert result.parsed_info == {"vehicle_number": ["YHU/805"]}
    c = result.corrections[0]
    assert c.was_corrected is False
    assert c.final_valid is False
    assert c.retries_used == 1
    assert c.error_hint is not None
    assert "retries exhausted" in c.error_hint


@pytest.mark.asyncio
async def test_llm_returns_null_keeps_original_with_decline_hint(
    patch_agent: Any,
) -> None:
    """LLM returning value=null means 'I can't read this; original is whatever
    OCR gave you'. Original kept, error_hint records the LLM's reasoning."""
    patch_agent(None)
    result = await correct_invalid_fields(
        parsed_info={"vehicle_number": ["YHU/805"]},
        doc_type="delivery_order",
        page_images=["fake-image"],
        model="m",
    )
    assert result.parsed_info == {"vehicle_number": ["YHU/805"]}
    c = result.corrections[0]
    assert c.was_corrected is False
    assert c.final_valid is False
    assert c.error_hint is not None
    assert "LLM declined" in c.error_hint


# ─── Per-run budget cap ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_budget_caps_total_correction_calls(patch_agent: Any) -> None:
    """With max_corrections_per_run=1, only the first invalid field gets an
    LLM call. Remaining invalid fields get a budget-exhausted audit row,
    original kept."""
    patch_agent("WXY1234")  # corrects first vehicle; second never reached
    result = await correct_invalid_fields(
        parsed_info={
            "vehicle_number": ["YHU/805", "ZZZ/999"],
            "date": "garbage",
        },
        doc_type="delivery_order",
        page_images=["fake-image"],
        model="m",
        max_corrections_per_run=1,
    )
    # First plate corrected; second + date kept.
    assert result.parsed_info["vehicle_number"] == ["WXY1234", "ZZZ/999"]
    assert result.parsed_info["date"] == "garbage"

    # 3 audit rows total, only 1 successful.
    assert len(result.corrections) == 3
    success_count = sum(1 for c in result.corrections if c.final_valid)
    budget_skipped = sum(
        1
        for c in result.corrections
        if c.error_hint and "budget exhausted" in c.error_hint
    )
    assert success_count == 1
    assert budget_skipped == 2


# ─── Scalar (str) field path ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_scalar_str_field_correction_uses_unindexed_path(
    patch_agent: Any,
) -> None:
    """Scalar-typed fields (e.g. invoice.bill_to_tin: str) get audit rows
    with bare path (no [0] suffix). Only list-typed fields use [i]."""
    patch_agent("IG12345678901")  # valid TIN
    result = await correct_invalid_fields(
        parsed_info={"bill_to_tin": "garbage-tin"},
        doc_type="invoice",
        page_images=["fake-image"],
        model="m",
    )
    assert result.parsed_info == {"bill_to_tin": "IG12345678901"}
    assert result.corrections[0].field_path == "bill_to_tin"


# ─── Vision-less mode (no images → corrections skipped at pipeline level) ────


@pytest.mark.asyncio
async def test_does_not_mutate_input_dict(patch_agent: Any) -> None:
    """Input parsed_info must NOT be mutated — caller may rely on the original
    for diffing / replay. Returned dict is always a new object."""
    patch_agent("WXY1234")
    original = {"vehicle_number": ["YHU/805"]}
    result = await correct_invalid_fields(
        parsed_info=original,
        doc_type="delivery_order",
        page_images=["fake-image"],
        model="m",
    )
    # Original untouched, returned dict is a different object.
    assert original == {"vehicle_number": ["YHU/805"]}
    assert result.parsed_info is not original


# ─── LLM failure path (exception during agent.run) ───────────────────────────


# ─── Concurrency: multiple in-budget corrections fan out via gather ──────────


@pytest.mark.asyncio
async def test_in_budget_corrections_run_concurrently(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two invalid fields at budget=2 must execute concurrently — wall time
    is roughly max(per-call), not sum. Asserted via an `asyncio.Event`: each
    fake `agent.run` increments an in-flight counter and waits until the
    counter has reached 2 before returning. If the loop were sequential the
    second call could never start, so the test would deadlock under the
    timeout."""
    in_flight = 0
    both_started = asyncio.Event()
    # Maps the invalid value seen in the prompt to the corrected response.
    # Lets us produce deterministic answers regardless of which task
    # the event loop schedules first.
    responses: dict[str, str] = {
        "YHU/805": "JHU8805",
        "garbage-tin": "IG12345678901",
    }

    async def _run(message: Any) -> _FakeRun:
        nonlocal in_flight
        # First positional message piece is the prompt string.
        prompt = message[0] if isinstance(message, list) else str(message)
        match = next((k for k in responses if k in prompt), None)
        in_flight += 1
        if in_flight >= 2:
            both_started.set()
        await asyncio.wait_for(both_started.wait(), timeout=1.0)
        return _FakeRun(responses.get(match) if match else None)

    fake = AsyncMock()
    fake.run = _run
    monkeypatch.setattr(correctors, "_build_correction_agent", lambda _m: fake)

    result = await correct_invalid_fields(
        parsed_info={
            # Different doc_type fields would not co-occur in real data,
            # but the registry walks any matching pair so we use one
            # doc_type with two registered invalid fields.
            "vehicle_number": ["YHU/805"],
            "date": "2026-12-32",  # invalid date
        },
        doc_type="delivery_order",
        page_images=["fake-image"],
        model="m",
        max_corrections_per_run=2,
    )
    # If gather did NOT run concurrently, the second call could never be
    # in-flight when the first awaits the event → asyncio.wait_for raises
    # TimeoutError → test fails before reaching this assert.
    assert in_flight == 2
    # vehicle_number corrected; date is harder to validate via the fake
    # path so skip its specific value — only assert the audit log size.
    assert result.parsed_info["vehicle_number"] == ["JHU8805"]
    assert len(result.corrections) == 2


@pytest.mark.asyncio
async def test_default_budget_is_two(patch_agent: Any) -> None:
    """Default `max_corrections_per_run=2`. Three invalid fields →
    first two attempted, third gets budget-skipped audit row."""
    patch_agent("WXY1234", "BCD5678")  # corrects 2 plates
    result = await correct_invalid_fields(
        parsed_info={
            "vehicle_number": ["YHU/805", "ZZZ/999", "QQQ/111"],
        },
        doc_type="delivery_order",
        page_images=["fake-image"],
        model="m",
        # max_corrections_per_run omitted → defaults to 2.
    )
    assert len(result.corrections) == 3
    in_budget = [
        c
        for c in result.corrections
        if c.error_hint != ("skipped: per-run correction budget exhausted")
    ]
    skipped = [
        c
        for c in result.corrections
        if c.error_hint == ("skipped: per-run correction budget exhausted")
    ]
    assert len(in_budget) == 2
    assert len(skipped) == 1


@pytest.mark.asyncio
async def test_llm_exception_keeps_original_with_error_hint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When the LLM call throws (network error, provider 5xx), the corrector
    must NOT propagate — keep original, record the error in the audit log.
    Observability outage shouldn't break extraction."""

    async def _raising_run(_msg: Any) -> Any:
        raise RuntimeError("LiteLLM timed out")

    fake = AsyncMock()
    fake.run = _raising_run
    monkeypatch.setattr(correctors, "_build_correction_agent", lambda _m: fake)

    result = await correct_invalid_fields(
        parsed_info={"vehicle_number": ["YHU/805"]},
        doc_type="delivery_order",
        page_images=["fake-image"],
        model="m",
    )
    assert result.parsed_info == {"vehicle_number": ["YHU/805"]}
    c = result.corrections[0]
    assert c.final_valid is False
    assert c.error_hint is not None
    assert "LLM call failed" in c.error_hint
