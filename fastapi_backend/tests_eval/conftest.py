"""Shared fixtures for triple-h test suite."""

import json
from pathlib import Path

import pytest


@pytest.fixture
def fixtures_dir() -> Path:
    return Path(__file__).parent / "fixtures"


def discover_fixture_pairs(directory: Path) -> list[tuple[Path, dict]]:
    """Find all (pdf, expected_json) pairs in a fixture directory."""
    pairs = []
    for pdf_path in sorted(directory.glob("*.pdf")):
        expected_path = pdf_path.with_suffix(".expected.json")
        if expected_path.exists():
            with open(expected_path) as f:
                expected = json.load(f)
            pairs.append((pdf_path, expected))
    return pairs


@pytest.fixture
def ground_truth_pairs(fixtures_dir):
    """Factory fixture: returns (pdf, expected_json) pairs for a doc type."""

    def _get(doc_type: str) -> list[tuple[Path, dict]]:
        return discover_fixture_pairs(fixtures_dir / doc_type)

    return _get
