"""Custom pydantic-evals evaluators for field-level document extraction comparison."""

import re
from dataclasses import dataclass, field

from pydantic import BaseModel
from pydantic_evals.evaluators import Evaluator, EvaluatorContext


def _normalize(text: str) -> str:
    """Normalize a string for fuzzy comparison: lowercase, collapse whitespace, strip punctuation edges."""
    text = text.strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


@dataclass
class NormalizedStringMatch(Evaluator):
    """Case-insensitive, whitespace-normalized string comparison."""

    def evaluate(self, ctx: EvaluatorContext) -> bool:
        if ctx.output is None and ctx.expected_output is None:
            return True
        if ctx.output is None or ctx.expected_output is None:
            return False
        return _normalize(str(ctx.output)) == _normalize(str(ctx.expected_output))


@dataclass
class NumericTolerance(Evaluator):
    """Compare numeric strings within a tolerance (for weights like '12.5000')."""

    tolerance: float = 0.01

    def evaluate(self, ctx: EvaluatorContext) -> bool:
        try:
            # Strip units like "t", "kg", "MT"
            expected = re.sub(
                r"[a-zA-Z]+$", "", str(ctx.expected_output).strip()
            ).strip()
            actual = re.sub(r"[a-zA-Z]+$", "", str(ctx.output).strip()).strip()
            return abs(float(expected) - float(actual)) <= self.tolerance
        except (ValueError, TypeError):
            return str(ctx.output) == str(ctx.expected_output)


@dataclass
class FieldAccuracy(Evaluator):
    """Per-field comparison of Pydantic model outputs. Returns a dict of field_name -> match (bool).

    Works with any Pydantic BaseModel output type. Compares each field using
    normalized string matching. List fields are compared element-wise.
    """

    skip_fields: list[str] = field(default_factory=list)

    def evaluate(self, ctx: EvaluatorContext) -> dict[str, bool]:
        expected = ctx.expected_output
        output = ctx.output

        if expected is None or output is None:
            return {"has_output": output is not None}

        if not isinstance(expected, BaseModel) or not isinstance(output, BaseModel):
            return {"type_match": isinstance(expected, type(output))}

        results: dict[str, bool] = {}
        for field_name in expected.model_fields:
            if field_name in self.skip_fields:
                continue

            expected_val = getattr(expected, field_name, None)
            actual_val = getattr(output, field_name, None)

            if expected_val is None and actual_val is None:
                results[field_name] = True
            elif expected_val is None or actual_val is None:
                results[field_name] = False
            elif isinstance(expected_val, list):
                results[field_name] = _compare_lists(expected_val, actual_val)
            else:
                results[field_name] = _normalize(str(expected_val)) == _normalize(
                    str(actual_val)
                )

        return results


def _compare_lists(expected: list, actual: list) -> bool:
    """Compare two lists element-wise with normalized string matching."""
    if not isinstance(actual, list):
        return False
    if len(expected) != len(actual):
        return False
    return all(
        _normalize(str(e)) == _normalize(str(a)) for e, a in zip(expected, actual)
    )
