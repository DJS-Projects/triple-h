"""5-strategy JSON extraction from LLM responses."""

import json
import re
from typing import Any


def extract_and_validate_json(response_text: str) -> dict[str, Any] | None:
    """
    Extract valid JSON from an LLM response.

    Tries 5 strategies in order:
    1. Markdown code blocks (```json ... ```)
    2. Parse entire response as JSON
    3. Balanced brace matching
    4. Fix common JSON errors (trailing commas, unquoted keys)
    5. Exhaustive search for first valid JSON object
    """
    if not response_text or not isinstance(response_text, str):
        return None

    text = response_text.strip()

    # Strategy 1: Markdown code blocks
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Strategy 2: Entire response
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 3: Brace matching
    json_str = _extract_by_braces(text)
    if json_str:
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass

        # Strategy 4: Fix common errors and retry
        fixed = _fix_common_json_errors(json_str)
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass

    # Strategy 5: Exhaustive search
    for start in range(len(text)):
        if text[start] == "{":
            depth = 0
            for end in range(start, len(text)):
                if text[end] == "{":
                    depth += 1
                elif text[end] == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start : end + 1])
                        except json.JSONDecodeError:
                            break

    return None


def _extract_by_braces(text: str) -> str | None:
    """Find the first balanced {} substring."""
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _fix_common_json_errors(json_str: str) -> str:
    """Fix trailing commas and unquoted property names."""
    fixed = re.sub(r",(\s*[}\]])", r"\1", json_str)
    fixed = re.sub(r"(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:", r'\1"\2":', fixed)
    return fixed
