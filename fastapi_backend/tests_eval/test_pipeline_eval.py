"""E2E evaluation tests using pydantic-evals.

Each doc-type has its own typed Dataset (see tests_eval/datasets/*.yaml).
We load, resolve PDF paths against the fixtures dir, and hand cases to the
extraction pipeline (extract_structured).

Run with:
    mise run be:test:eval

Run the full pipeline (requires API key + Docling + VLM):
    TRIPLE_H_RUN_PIPELINE=1 mise run be:test:eval
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypeVar

import pytest

from pydantic import BaseModel
from pydantic_evals import Dataset

from tests_eval.evaluators import (
    FieldAccuracy,
    NormalizedStringMatch,
    NumericTolerance,
)
from tests_eval.schemas import (
    DeliveryOrder,
    ExtractionInputs,
    FixtureMetadata,
)

TESTS_EVAL_DIR = Path(__file__).parent
DATASETS_DIR = TESTS_EVAL_DIR / "datasets"
REPORTS_DIR = TESTS_EVAL_DIR / "reports"

# Custom evaluator types must be registered explicitly so pydantic-evals
# can deserialize them from the YAML `evaluators:` block.
_CUSTOM_EVALUATORS = [FieldAccuracy, NormalizedStringMatch, NumericTolerance]

OutputT = TypeVar("OutputT", bound=BaseModel)


def _load_dataset(
    name: str, output_type: type[OutputT]
) -> Dataset[ExtractionInputs, OutputT, FixtureMetadata]:
    """Load a doc-type dataset with typed generics bound at call site."""
    return Dataset[ExtractionInputs, output_type, FixtureMetadata].from_file(
        DATASETS_DIR / f"{name}.yaml",
        custom_evaluator_types=_CUSTOM_EVALUATORS,
    )


def _resolve_pdf(inputs: ExtractionInputs) -> Path:
    """Resolve a dataset-relative PDF path against the tests_eval root."""
    return TESTS_EVAL_DIR / inputs.pdf_path


# ─── Harness health: not an accuracy eval ──────────────────────────────────
# These tests verify the test *infrastructure* — that YAML fixtures parse,
# pass schema validation (strict via ConfigDict(extra="forbid")), and point
# at PDFs that exist on disk. They do NOT measure extraction accuracy —
# that is test_pipeline_accuracy below.


_DATASET_SPECS: list[tuple[str, type[BaseModel]]] = [
    ("delivery_orders", DeliveryOrder),
]


@pytest.mark.eval
@pytest.mark.parametrize(("name", "output_type"), _DATASET_SPECS)
def test_harness_fixtures_valid(name: str, output_type: type[BaseModel]) -> None:
    """Harness health check: dataset parses, schema validates, PDFs exist.

    This is NOT an accuracy eval — see test_pipeline_accuracy for that.
    """
    ds = _load_dataset(name, output_type)
    assert ds.cases, f"{name}: no cases loaded"
    for case in ds.cases:
        pdf = _resolve_pdf(case.inputs)
        assert pdf.exists(), f"{name}/{case.name}: PDF missing at {pdf}"
        assert isinstance(case.expected_output, output_type), (
            f"{name}/{case.name}: expected_output is {type(case.expected_output).__name__}, "
            f"not {output_type.__name__}"
        )


# ─── Report writer ──────────────────────────────────────────────────────────


def _format_val(val: Any, indent: int = 20) -> str:
    """Format a field value for the report — truncate long strings."""
    text = str(val)
    if len(text) > 60:
        text = text[:57] + "..."
    if "\n" in text:
        text = text.replace("\n", " ")
    return text


def _write_report_file(
    name: str,
    report: Any,
    passed: int,
    failed: int,
) -> Path:
    """Write a detailed human-readable eval report to tests_eval/reports/."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = REPORTS_DIR / f"{name}_{timestamp}.txt"

    avg = report.averages()
    total_assertions = (
        f"{avg.assertions:.0%}" if avg and avg.assertions is not None else "N/A"
    )
    output_type_name = (
        report.cases[0].output.__class__.__name__ if report.cases else "?"
    )

    lines: list[str] = []
    _w = lines.append
    _w("=" * 72)
    _w(f"  Triple-H Pipeline Eval Report  —  {name}")
    _w("=" * 72)
    _w("")
    _w(f"  Dataset:          {name}")
    _w(f"  Output schema:    {output_type_name}")
    _w(f"  Total cases:      {len(report.cases) + len(report.failures)}")
    _w(f"  Passed:           {passed}")
    _w(f"  Failed:           {failed}")
    _w(f"  Field accuracy:   {total_assertions}  (aggregate)")
    _w(
        f"  Date:             {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
    )
    _w("")

    # Per-case detail
    _w("=" * 72)
    _w("  Per-Case Results")
    _w("=" * 72)
    _w("")

    for i, case in enumerate(report.cases, 1):
        case_passed = sum(1 for a in case.assertions.values() if a.value)
        case_total = len(case.assertions)
        case_pct = (
            f"{case_passed}/{case_total} ({case_passed / case_total * 100:.1f}%)"
            if case_total
            else "no assertions"
        )
        verdict = "PASS" if case_passed == case_total else "FAIL"
        _w(f"  {i}. {case.name}")
        _w(f"     Verdict:       {verdict}   ({case_pct})")
        _w(f"     Duration:      {case.task_duration:.1f}s")
        _w("")
        _w(f"     {'FIELD':<25} {'RESULT':>6}   VALUE")
        _w(f"     {'─' * 25} {'─' * 6}   {'─' * 40}")

        expected = case.expected_output
        actual = case.output
        for field_name, result in case.assertions.items():
            expected_val = _format_val(getattr(expected, field_name, ""))
            actual_val = _format_val(getattr(actual, field_name, ""))
            mark = "✅" if result.value else "❌"
            if result.value:
                _w(f"     {field_name:<25} {mark:>6}   {actual_val}")
            else:
                _w(f"     {field_name:<25} {mark:>6}   {actual_val}")
                _w(f"     {'':25} {'':6}   expected: {expected_val}")
        _w("")

    # Case failures
    if report.failures:
        _w("=" * 72)
        _w("  Case Failures (pipeline error — no output produced)")
        _w("=" * 72)
        _w("")
        for failure in report.failures:
            _w(f"  - {failure.name}")
            _w(f"    Error: {failure.error_message}")
            _w("")

    # Field-level pass/fail matrix
    if report.cases:
        _w("=" * 72)
        _w("  Field-Level Pass/Fail Matrix")
        _w("=" * 72)
        _w("")

        field_names = list(report.cases[0].assertions.keys())
        max_fname = max(len(f) for f in field_names) + 2
        col_width = max(28, max(len(c.name) + 8 for c in report.cases))
        header = f"  {'FIELD':<{max_fname}}"
        for case in report.cases:
            header += f"  {case.name:<{col_width - 2}}"
        _w(header)
        _w(f"  {'─' * (max_fname + col_width * len(report.cases))}")

        for field_name in field_names:
            row = f"  {field_name:<{max_fname}}"
            for case in report.cases:
                result = case.assertions.get(field_name)
                if result is None:
                    row += f"  {'?':>{col_width - 2}}"
                elif result.value:
                    row += f"  {'✅ PASS':>{col_width - 2}}"
                else:
                    row += f"  {'❌ FAIL':>{col_width - 2}}"
            _w(row)
        _w("")

    _w("=" * 72)
    _w(f"  End of report — {timestamp}")
    _w("=" * 72)

    path.write_text("\n".join(lines))
    return path


# ─── End-to-end pipeline evaluation ────────────────────────────────────────
# Skipped by default — opt in via TRIPLE_H_RUN_PIPELINE=1.


_RUN_PIPELINE = os.environ.get("TRIPLE_H_RUN_PIPELINE") == "1"


@pytest.mark.eval
@pytest.mark.skipif(not _RUN_PIPELINE, reason="Set TRIPLE_H_RUN_PIPELINE=1 to run")
@pytest.mark.parametrize(("name", "output_type"), _DATASET_SPECS)
async def test_pipeline_accuracy(name: str, output_type: type[BaseModel]) -> None:
    """Run the fast pipeline against a doc-type dataset and gate on accuracy."""
    ds = _load_dataset(name, output_type)

    from app.services.architecture import DocType

    _DOC_TYPE_MAP: dict[str, DocType] = {
        "delivery_orders": "delivery_order",
        "weighing_bills": "weighing_bill",
        "invoices": "invoice",
    }

    async def run_pipeline(inputs: ExtractionInputs) -> BaseModel:
        from app.services.extraction import extract_structured

        pdf_path = _resolve_pdf(inputs)
        pdf_bytes = pdf_path.read_bytes()
        doc_type = _DOC_TYPE_MAP[name]
        result = await extract_structured(
            pdf_bytes=pdf_bytes,
            filename=pdf_path.name,
            doc_type=doc_type,
        )
        return output_type(**result.extracted)

    report = await ds.evaluate(run_pipeline)
    report.print()

    # Per-case field-level accuracy breakdown
    print(f"\n─── {name} Per-case Accuracy ─────────────────────")
    passed_cases = 0
    failed_cases = 0
    for case in report.cases:
        case_passed = sum(1 for a in case.assertions.values() if a.value)
        case_total = len(case.assertions)
        if case_total:
            pct = case_passed / case_total * 100
            print(f"  {case.name:<30} {case_passed:>2}/{case_total:<2} ({pct:>5.1f}%)")
            if case_passed == case_total:
                passed_cases += 1
            else:
                failed_cases += 1
        else:
            print(f"  {case.name:<30} no assertions")
    print(
        f"\n  Result: {passed_cases} passed, {failed_cases} failed"
        f"  ({len(report.failures)} pipeline errors)"
    )

    report_path = _write_report_file(name, report, passed_cases, failed_cases)
    print(f"\n  Detailed report written to: {report_path}")
