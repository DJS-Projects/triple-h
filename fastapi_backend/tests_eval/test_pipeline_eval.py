"""E2E evaluation tests using pydantic-evals.

Each doc-type has its own typed Dataset (see tests_eval/datasets/*.yaml).
We load, resolve PDF paths against the fixtures dir, and hand cases to the
fast pipeline. The pipeline itself is not wired up yet — this file exists to
prove the harness round-trips cleanly.

Run with:
    mise run be:test:eval

Run the full pipeline (requires API key + Docling + VLM):
    TRIPLE_H_RUN_PIPELINE=1 mise run be:test:eval
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import TypeVar

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
    Invoice,
    WeighingBill,
)

TESTS_EVAL_DIR = Path(__file__).parent
DATASETS_DIR = TESTS_EVAL_DIR / "datasets"

# Custom evaluator types must be registered explicitly so pydantic-evals
# can deserialize them from the YAML `evaluators:` block.
_CUSTOM_EVALUATORS = [FieldAccuracy, NormalizedStringMatch, NumericTolerance]

# Minimum field-accuracy threshold per doc-type. Deliberately loose — we're
# establishing a baseline, not grading a finished pipeline.
_MIN_ACCURACY: dict[str, float] = {
    "delivery_orders": 0.50,
    "weighing_bills": 0.50,
    "invoices": 0.50,
}

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
    ("weighing_bills", WeighingBill),
    ("invoices", Invoice),
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


# ─── End-to-end pipeline evaluation ────────────────────────────────────────
# Skipped by default — opt in via TRIPLE_H_RUN_PIPELINE=1 once the fast
# pipeline is wired up. Kept here so the shape is obvious before we implement.


_RUN_PIPELINE = os.environ.get("TRIPLE_H_RUN_PIPELINE") == "1"


@pytest.mark.eval
@pytest.mark.skipif(not _RUN_PIPELINE, reason="Set TRIPLE_H_RUN_PIPELINE=1 to run")
@pytest.mark.parametrize(("name", "output_type"), _DATASET_SPECS)
def test_pipeline_accuracy(name: str, output_type: type[BaseModel]) -> None:
    """Run the fast pipeline against a doc-type dataset and gate on accuracy."""
    ds = _load_dataset(name, output_type)

    def run_pipeline(inputs: ExtractionInputs) -> BaseModel:
        # TODO: wire up FastPipeline here — Docling → Gemini 2.5 Flash → output_type
        raise NotImplementedError(
            f"FastPipeline not yet implemented (requested doc-type: {name})"
        )

    report = ds.evaluate_sync(run_pipeline)
    report.print()

    avg = report.averages()
    threshold = _MIN_ACCURACY[name]
    if avg and avg.assertions is not None:
        assert avg.assertions >= threshold, (
            f"{name}: field accuracy {avg.assertions:.1%} below {threshold:.0%} threshold"
        )
