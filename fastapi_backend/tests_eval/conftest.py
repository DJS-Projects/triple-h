"""Shared fixtures for triple-h eval test suite.

Ground truth is loaded through pydantic-evals `Dataset.from_file()` in each
test module — see tests_eval/test_pipeline_eval.py. No shared discovery
helpers are needed here; this module is kept as a pytest anchor point for
future per-doc-type fixtures.
"""

from pathlib import Path

import pytest


@pytest.fixture
def fixtures_dir() -> Path:
    return Path(__file__).parent / "fixtures"
