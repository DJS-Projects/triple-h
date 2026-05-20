"""Self-correcting field validators for extraction output.

Runs after postprocess in the ARQ pipeline. Walks each field with a
known format validator (Malaysian vehicle plates, LHDN TINs, ISO/MY
dates, MY postcodes), and for any invalid value:

  1. Builds a focused "fix this one field" prompt with the page image(s)
     and a hint about what the format should look like.
  2. Calls the LLM via the same LiteLLM proxy used by the main extractor.
  3. Re-validates the corrected value.
  4. If still invalid after `max_retries_per_field` attempts, falls
     through and KEEPS the original value (per project decision —
     strict validation but tolerant when the LLM can't fix it; better
     to ship a flagged-but-original value than 502 the whole request).

Every attempt — successful or not — is recorded in a `FieldCorrection`
audit row, persisted into `ExtractionEnvelope.corrections`. The FE can
surface "this field had OCR garbage, was auto-corrected, here's what
changed" badges later (deferred to T11 follow-up).

Deliberately NOT applied to:
  - ID-code fields (do_number, po_number, weighing_no, contract_no):
    these are customer-internal formats with no public spec. We can't
    distinguish "OCR garbled it" from "the customer uses an unusual
    format".
  - Free-form text fields (sold_to, do_issuer_name, addresses): no
    canonical format; comparison would fall back to fuzzy match,
    which belongs in the company canonicalization pipeline (T10).

Cost note: each correction call is a full LLM round-trip (~30s on
ollama-gemma4-31b). In-budget corrections run **concurrently** via
`asyncio.gather`, so wall time is roughly the slowest single call
rather than the sum. The `max_corrections_per_run` budget (default 2)
caps both the concurrency fan-out and the worst-case latency on a
doc with many invalid fields.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Final

from dateutil import parser as date_parser
from pydantic import BaseModel, ConfigDict
from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.config import settings
from app.services.extraction.validators import (
    is_valid_plate,
    is_valid_tin,
    state_for_postcode,
)

_log = logging.getLogger(__name__)


# ─── Audit log shape (persists into ExtractionEnvelope) ─────────────────────


@dataclass(frozen=True)
class FieldCorrection:
    """One entry in the per-run correction audit trail.

    Captures both successful corrections and exhausted-retry failures.
    `final_valid` distinguishes them: True = LLM produced a valid value,
    False = retries exhausted, original kept.
    """

    field_path: str  # FE-flattened (e.g. "vehicle_number[0]")
    original_value: str
    final_value: str
    was_corrected: bool  # True if final_value differs from original_value
    final_valid: bool
    retries_used: int
    error_hint: str | None = None


# ─── Validators ─────────────────────────────────────────────────────────────


def _is_valid_date(value: str) -> bool:
    """True iff `value` parses as a date with `dayfirst=True` (MY convention)."""
    if not value or not value.strip():
        return False
    try:
        date_parser.parse(value, dayfirst=True, fuzzy=False)
        return True
    except (ValueError, OverflowError):
        return False


def _is_valid_postcode(value: str) -> bool:
    """True iff `value` is a 5-digit postcode mapping to a documented MY range."""
    if not value:
        return False
    return state_for_postcode(value.strip()) is not None


# ─── Per (doc_type, field_path) validator + correction-hint registry ────────


FieldValidator = Callable[[str], bool]


_VEHICLE_PLATE_HINT: Final = (
    "Malaysian vehicle plate. Format: state prefix (one of A, B, C, D, F, J, "
    "K, KV, L, M, N, P, Q-prefix for Sarawak, R, S-prefix for Sabah, T, V, W) "
    "followed by 1-2 alpha + 1-4 digits + optional trailing alpha. Examples: "
    "WXY1234, JHU8805, QAB123, SAA1234A. NO slashes, dots, or other punctuation. "
    "Do not remove any characters, instead convert them to the closest valid format (e.g. O → 0, / → 1) if needed. "
    "If the document genuinely shows a non-plate identifier (fleet number, "
    "trailer ID), return null rather than guessing."
)

_TIN_HINT: Final = (
    "Malaysian LHDN Tax Identification Number. Active formats: IG##########, "
    "C###########, D###########, E###########, F###########, J###########, "
    "PT###########, CS##########, FA###########, LE###########, "
    "TA/TC/TN/TR/TP###########. Legacy: SG/OG ##########. If unparseable, "
    "return null."
)

_DATE_HINT: Final = (
    "Date string in any of: YYYY-MM-DD (ISO), DD/MM/YYYY, DD-MM-YYYY, "
    "DD.MM.YYYY. Malaysia uses day-first convention. If the document shows "
    "no clear date or it's illegible, return null."
)

_POSTCODE_HINT: Final = (
    "Malaysian 5-digit postcode (e.g. 14200, 50480). Must fall within a "
    "documented state range. If unreadable, return null."
)


# Schema-key form (no [0]). The corrector handles list-typed fields by
# walking each element.
_VALIDATORS: Final[dict[tuple[str, str], tuple[FieldValidator, str]]] = {
    # Delivery order
    ("delivery_order", "vehicle_number"): (is_valid_plate, _VEHICLE_PLATE_HINT),
    ("delivery_order", "date"): (_is_valid_date, _DATE_HINT),
    # Weighing bill
    ("weighing_bill", "vehicle_no"): (is_valid_plate, _VEHICLE_PLATE_HINT),
    # Invoice
    ("invoice", "invoice_date"): (_is_valid_date, _DATE_HINT),
    ("invoice", "bill_to_tin"): (is_valid_tin, _TIN_HINT),
    ("invoice", "from_tin"): (is_valid_tin, _TIN_HINT),
    # Petrol bill
    ("petrol_bill", "plate_number"): (is_valid_plate, _VEHICLE_PLATE_HINT),
    ("petrol_bill", "purchase_datetime"): (_is_valid_date, _DATE_HINT),
}


# ─── Single-field correction agent ──────────────────────────────────────────


class _CorrectionResponse(BaseModel):
    """Tiny schema for the correction LLM call.

    `value` is the corrected string OR null if the LLM judges the document
    genuinely doesn't contain a valid value for this field. `reasoning`
    is a one-liner explaining why — captured into the audit log.
    """

    model_config = ConfigDict(extra="forbid")

    value: str | None
    reasoning: str


def _build_correction_agent(model: str) -> Agent[None, _CorrectionResponse]:
    llm_model = OpenAIChatModel(
        model,
        provider=OpenAIProvider(
            base_url=settings.LITELLM_BASE_URL,
            api_key=settings.LITELLM_MASTER_KEY,
        ),
    )
    return Agent(llm_model, output_type=PromptedOutput(_CorrectionResponse))


def _build_correction_prompt(
    field_path: str,
    invalid_value: str,
    format_hint: str,
    previous_attempts: list[str],
) -> str:
    """Compose the correction prompt sent to the LLM.

    Includes the field name, the rejected value, the format spec, and
    (on retries) the previous failed attempts so the model doesn't loop
    on the same wrong answer.
    """
    parts = [
        f"The field `{field_path}` was extracted as `{invalid_value}`, "
        f"but this fails format validation.",
        "",
        "Look at the page image and re-extract this field correctly.",
        "",
        f"Required format: {format_hint}",
    ]
    if previous_attempts:
        parts.extend(
            [
                "",
                "Previous attempts that also failed validation:",
                *(f"  - `{a}`" for a in previous_attempts),
                "",
                "Do NOT propose any of those. If the document genuinely has no "
                "valid value here, return null in `value`.",
            ]
        )
    return "\n".join(parts)


# ─── Public entrypoint ──────────────────────────────────────────────────────


@dataclass
class CorrectionRunResult:
    """Output of `correct_invalid_fields`."""

    parsed_info: dict[str, Any]
    corrections: list[FieldCorrection] = field(default_factory=list)


@dataclass(frozen=True)
class _PendingCorrection:
    """Bookkeeping for a single invalid value awaiting correction.

    Captured during the deterministic collect-pass so the parallel
    execution-pass can dispatch tasks via `asyncio.gather` while
    preserving registry order in the audit log + budget split.
    """

    field_key: str
    idx: int  # always meaningful; for scalar fields use 0
    is_list: bool
    invalid_value: str
    validator: FieldValidator
    format_hint: str
    field_path: str  # FE-flattened (`vehicle_number[0]` or `bill_to_tin`)


async def correct_invalid_fields(
    *,
    parsed_info: dict[str, Any],
    doc_type: str,
    page_images: list[BinaryContent],
    model: str,
    max_retries_per_field: int = 1,
    max_corrections_per_run: int = 2,
) -> CorrectionRunResult:
    """Validate every registered field; correct invalid values via LLM retry.

    Returns a NEW dict (input is not mutated) plus an audit log of every
    correction attempt (successes AND retry-exhausted failures). Failed
    corrections leave the original value in place — per-project policy:
    strict validation but tolerant on exhaust, never error out the run.

    `max_corrections_per_run` is a latency cap. Each LLM call is ~30s;
    a doc with many invalid fields would otherwise blow up. After the
    cap is hit, remaining invalid fields are flagged in the audit log
    with `was_corrected=False, final_valid=False` and an `error_hint`
    of "skipped: per-run correction budget exhausted".

    Execution: in-budget corrections run **concurrently** via
    `asyncio.gather`. With `max_corrections_per_run=2` (the default),
    wall time is roughly the slowest single correction rather than the
    sum. Audit log + value updates are merged back in deterministic
    registry order so persistence and tests stay reproducible.
    """
    out = dict(parsed_info)

    # ── Phase 1 — collect pass ───────────────────────────────────────────
    # Walk the registry in insertion order; build a flat list of every
    # invalid value that needs correction. Determinism here is the
    # contract the budget split + audit log rely on.
    pending: list[_PendingCorrection] = []
    for (registered_doc_type, field_key), (
        validator,
        format_hint,
    ) in _VALIDATORS.items():
        if registered_doc_type != doc_type or field_key not in out:
            continue
        value = out[field_key]
        if value is None or value == "" or value == []:
            continue
        is_list = isinstance(value, list)
        items = value if is_list else [value]
        for idx, item in enumerate(items):
            if not isinstance(item, str) or validator(item):
                continue
            field_path = f"{field_key}[{idx}]" if is_list else field_key
            pending.append(
                _PendingCorrection(
                    field_key=field_key,
                    idx=idx,
                    is_list=is_list,
                    invalid_value=item,
                    validator=validator,
                    format_hint=format_hint,
                    field_path=field_path,
                )
            )

    # ── Phase 2 — budget split ───────────────────────────────────────────
    # First N pending tasks get an LLM call; the rest record a
    # budget-exhausted audit row. Order is registry order, so the
    # split is deterministic across runs.
    in_budget = pending[:max_corrections_per_run]
    over_budget = pending[max_corrections_per_run:]

    # ── Phase 3 — concurrent dispatch ────────────────────────────────────
    # `_try_correct_field` is internally sequential (retry loop within a
    # single field) but independent across fields, so gather is safe.
    # Each task builds its own agent via `_build_correction_agent`.
    task_results = await asyncio.gather(
        *(
            _try_correct_field(
                field_path=p.field_path,
                invalid_value=p.invalid_value,
                validator=p.validator,
                format_hint=p.format_hint,
                page_images=page_images,
                model=model,
                max_retries=max_retries_per_field,
            )
            for p in in_budget
        )
    )

    # ── Phase 4 — merge ──────────────────────────────────────────────────
    corrections: list[FieldCorrection] = []
    # Keyed by field_key → list of (idx, corrected_value) so list-typed
    # fields can be reassembled atomically below.
    per_key_updates: dict[str, list[tuple[int, str]]] = {}

    for p, (corrected, retries, final_valid, hint) in zip(
        in_budget, task_results, strict=True
    ):
        corrections.append(
            FieldCorrection(
                field_path=p.field_path,
                original_value=p.invalid_value,
                final_value=corrected,
                was_corrected=corrected != p.invalid_value,
                final_valid=final_valid,
                retries_used=retries,
                error_hint=hint,
            )
        )
        if corrected != p.invalid_value:
            per_key_updates.setdefault(p.field_key, []).append((p.idx, corrected))

    for p in over_budget:
        corrections.append(
            FieldCorrection(
                field_path=p.field_path,
                original_value=p.invalid_value,
                final_value=p.invalid_value,
                was_corrected=False,
                final_valid=False,
                retries_used=0,
                error_hint="skipped: per-run correction budget exhausted",
            )
        )

    for field_key, updates in per_key_updates.items():
        original_value = out[field_key]
        if isinstance(original_value, list):
            new_list = list(original_value)
            for idx, corrected in updates:
                new_list[idx] = corrected
            out[field_key] = new_list
        else:
            # Scalar field: exactly one update by construction (idx=0).
            out[field_key] = updates[0][1]

    return CorrectionRunResult(parsed_info=out, corrections=corrections)


async def _try_correct_field(
    *,
    field_path: str,
    invalid_value: str,
    validator: FieldValidator,
    format_hint: str,
    page_images: list[BinaryContent],
    model: str,
    max_retries: int,
) -> tuple[str, int, bool, str | None]:
    """Single field's correction loop.

    Returns (final_value, retries_used, final_valid, error_hint). On
    every failure path, returns the ORIGINAL value with `final_valid=False`
    so the caller can preserve it via the fall-through policy.
    """
    agent = _build_correction_agent(model)
    previous_attempts: list[str] = [invalid_value]
    last_value = invalid_value
    last_reason: str | None = None

    for attempt in range(max_retries + 1):
        prompt = _build_correction_prompt(
            field_path=field_path,
            invalid_value=invalid_value,
            format_hint=format_hint,
            previous_attempts=previous_attempts[1:],  # exclude original itself
        )
        message: list[Any] = [prompt, *page_images]
        try:
            run = await agent.run(message)
        except Exception as exc:  # noqa: BLE001 — LLM failure shouldn't break extraction
            _log.warning(
                "Correction LLM call failed for %s: %s — keeping original",
                field_path,
                exc,
            )
            return invalid_value, attempt, False, f"LLM call failed: {exc}"

        candidate = run.output.value
        last_reason = run.output.reasoning

        if candidate is None:
            # LLM committed to "no valid value here" — keep original but
            # flag as non-corrected, attempt count includes this round.
            _log.info(
                "Correction for %s: LLM returned null with reason: %s",
                field_path,
                last_reason,
            )
            return (
                invalid_value,
                attempt,
                False,
                f"LLM declined to correct: {last_reason}",
            )

        if validator(candidate):
            # Valid! Done.
            return candidate, attempt, True, None

        # Still invalid — record + maybe retry.
        previous_attempts.append(candidate)
        last_value = candidate

    # Retries exhausted. Per project policy: keep original, flag.
    return (
        invalid_value,
        max_retries,
        False,
        f"retries exhausted; last LLM attempt {last_value!r} also invalid; "
        f"reason: {last_reason}",
    )


# ─── Used by tests + traces — exposed for inspection only ───────────────────


def _registered_validators() -> dict[tuple[str, str], tuple[FieldValidator, str]]:
    """Return the validator registry. Test-only accessor."""
    return dict(_VALIDATORS)


# datetime import retained because some callers may want to log
# wall-clock times on long correction loops.
__all__ = [
    "FieldCorrection",
    "CorrectionRunResult",
    "correct_invalid_fields",
    "_registered_validators",
    "datetime",
]
