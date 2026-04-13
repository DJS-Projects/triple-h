"""E2E evaluation tests using pydantic-evals.

Run with: mise run be:test:eval
Requires fixtures in tests_eval/fixtures/ with PDF + .expected.json pairs.
"""

import json
from pathlib import Path

import pytest

from pydantic_evals import Case, Dataset

from tests_eval.evaluators import FieldAccuracy

FIXTURES_DIR = Path(__file__).parent / "fixtures"
DOC_TYPES = ["delivery_orders", "invoices", "weighing_bills", "petrol_bills"]


def _discover_all_fixtures() -> list[tuple[str, Path, dict]]:
    fixtures = []
    for doc_type in DOC_TYPES:
        type_dir = FIXTURES_DIR / doc_type
        if not type_dir.exists():
            continue
        for pdf_path in sorted(type_dir.glob("*.pdf")):
            expected_path = pdf_path.with_suffix(".expected.json")
            if expected_path.exists():
                with open(expected_path) as f:
                    expected = json.load(f)
                fixtures.append((doc_type, pdf_path, expected))
    return fixtures


ALL_FIXTURES = _discover_all_fixtures()


@pytest.mark.eval
@pytest.mark.skipif(len(ALL_FIXTURES) == 0, reason="No fixture pairs found")
class TestPipelineEval:
    @pytest.fixture
    def eval_dataset(self):
        cases = []
        for doc_type, pdf_path, expected in ALL_FIXTURES:
            cases.append(
                Case(
                    name=f"{doc_type}/{pdf_path.stem}",
                    inputs={"pdf_path": str(pdf_path), "doc_type": doc_type},
                    expected_output=expected,
                )
            )
        return Dataset(
            name="pipeline_eval",
            cases=cases,
            evaluators=[FieldAccuracy()],
        )

    def test_extraction_accuracy(self, eval_dataset):
        def run_pipeline(inputs: dict) -> dict:
            # TODO: Wire up Docling + PydanticAI pipeline here
            raise NotImplementedError(
                "Pipeline not yet implemented — build with Docling + PydanticAI"
            )

        report = eval_dataset.evaluate_sync(run_pipeline)
        report.print()

        avg = report.averages()
        if avg and avg.assertions is not None:
            assert avg.assertions >= 0.70, (
                f"Field accuracy {avg.assertions:.1%} below 70% threshold"
            )
