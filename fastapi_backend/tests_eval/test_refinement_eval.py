"""Refinement eval — IoU + classification accuracy.

Eval harness for the VLM refinement layer. Two metrics:

  - **classification_accuracy** — fraction of fields where the
    Signature's `assign` patch picked the same fragment id a human
    annotator marked as ground truth.
  - **iou_macro** — when the Signature emits new bboxes (Phase 2+),
    Intersection-over-Union against the annotator's bbox, averaged
    across fields.

Phase 1 only exercises classification_accuracy; iou_macro is wired up
so Phase 2/3 lands without harness churn.

Fixtures
--------
Ground truth lives in `tests_eval/fixtures/refinement/` as YAML files,
one per labeled doc:

    extraction_run_id: 42
    page_no: 1
    fields:
      do_number:
        fragment_id: f37
        bbox: { l: 401.67, t: 801.37, r: 530.67, b: 790.71 }
      issuer.name:
        fragment_id: f5
        bbox: { l: 45.33, t: 698.71, r: 228.0, b: 689.71 }

Run with:
    mise run be:test:eval -- tests_eval/test_refinement_eval.py
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

# Ground truth fixtures live next to this file. Empty-set tolerated for
# Phase 1 — we'll add real fixtures as labeling progresses.
FIXTURES_DIR = Path(__file__).parent / "fixtures" / "refinement"


def iou(a: dict[str, float], b: dict[str, float]) -> float:
    """Standard axis-aligned IoU. Inputs are {l,t,r,b} dicts.

    Returns 0.0 when either rectangle is degenerate or non-overlapping.
    Symmetric, [0,1]-bounded.
    """
    ax1, ay1, ax2, ay2 = a["l"], a["t"], a["r"], a["b"]
    bx1, by1, bx2, by2 = b["l"], b["t"], b["r"], b["b"]

    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0

    aw, ah = max(0.0, ax2 - ax1), max(0.0, ay2 - ay1)
    bw, bh = max(0.0, bx2 - bx1), max(0.0, by2 - by1)
    union = aw * ah + bw * bh - inter
    if union <= 0:
        return 0.0
    return inter / union


def classification_accuracy(predicted: dict[str, str], truth: dict[str, str]) -> float:
    """Fraction of fields where predicted fragment_id == truth fragment_id.

    Fields present in `truth` but absent from `predicted` count as
    misses. Predictions outside `truth` are ignored — they may be
    valid; we only score what we have ground truth for.
    """
    if not truth:
        return 1.0
    hits = sum(1 for k, v in truth.items() if predicted.get(k) == v)
    return hits / len(truth)


def iou_macro(
    predicted: dict[str, dict[str, float]],
    truth: dict[str, dict[str, float]],
) -> float:
    """Macro-IoU over labeled fields. 0 when no truth provided."""
    if not truth:
        return 0.0
    return sum(
        iou(predicted.get(k, {}), v) for k, v in truth.items() if predicted.get(k)
    ) / len(truth)


# ---------------------------------------------------------------------------
# Unit tests for the metrics themselves — these run without fixtures.
# ---------------------------------------------------------------------------


def test_iou_perfect_match() -> None:
    a = {"l": 10.0, "t": 10.0, "r": 20.0, "b": 20.0}
    assert iou(a, a) == pytest.approx(1.0)


def test_iou_no_overlap() -> None:
    a = {"l": 10.0, "t": 10.0, "r": 20.0, "b": 20.0}
    b = {"l": 30.0, "t": 30.0, "r": 40.0, "b": 40.0}
    assert iou(a, b) == 0.0


def test_iou_half_overlap() -> None:
    a = {"l": 0.0, "t": 0.0, "r": 10.0, "b": 10.0}
    b = {"l": 5.0, "t": 0.0, "r": 15.0, "b": 10.0}
    # intersection 50, union 150 → 1/3
    assert iou(a, b) == pytest.approx(1 / 3)


def test_classification_accuracy_perfect() -> None:
    truth = {"do_number": "f37", "issuer.name": "f5"}
    assert classification_accuracy(truth, truth) == 1.0


def test_classification_accuracy_partial() -> None:
    truth = {"do_number": "f37", "issuer.name": "f5"}
    pred = {"do_number": "f37", "issuer.name": "f99"}
    assert classification_accuracy(pred, truth) == 0.5


def test_classification_accuracy_missing_field() -> None:
    truth = {"do_number": "f37", "issuer.name": "f5"}
    pred = {"do_number": "f37"}
    assert classification_accuracy(pred, truth) == 0.5


# ---------------------------------------------------------------------------
# Live eval — runs only when fixtures + pipeline credentials available.
# ---------------------------------------------------------------------------


def _load_fixtures() -> list[dict[str, Any]]:
    if not FIXTURES_DIR.exists():
        return []
    out: list[dict[str, Any]] = []
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return []
    for path in sorted(FIXTURES_DIR.glob("*.yaml")):
        out.append(yaml.safe_load(path.read_text()))
    return out


@pytest.mark.eval
@pytest.mark.skipif(
    not _load_fixtures(),
    reason="no labeled fixtures yet — add YAMLs under tests_eval/fixtures/refinement/",
)
def test_classification_accuracy_meets_floor() -> None:
    """Smoke test: refinement Signature beats a trivial floor on labeled docs.

    Floor is intentionally low (0.5) for Phase 1 — we want to detect
    catastrophic regressions, not gate on perfection. Ratchet up as
    fixtures grow and prompt versions stabilize.
    """
    pytest.skip(
        "Wire to live pipeline once at least one labeled fixture exists; "
        "depends on database + LiteLLM + Google API key being configured."
    )
