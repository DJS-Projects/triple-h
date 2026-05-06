"""Apply `FieldReview` edits on top of an immutable extraction payload.

We never mutate `extraction_run.payload`. The user-facing extraction is
computed at read time by overlaying the latest `FieldReview` per
`field_path` onto a deep copy of `payload["extracted"]`.

`field_path` syntax (MVP)
-------------------------
- `do_number`           → top-level key
- `customer.name`       → nested object key
- `items`               → replace entire array (no per-element editing yet)

Array element editing (`items.0.quantity`) is intentionally out of scope
for the PoC. Frontend should send a full replacement of the `items` list
when a row changes.
"""

from __future__ import annotations

import copy
from typing import Any


def _set_path(target: dict[str, Any], path: str, value: Any) -> None:
    parts = path.split(".")
    if not parts or any(not p for p in parts):
        raise ValueError(f"invalid field_path: {path!r}")
    cursor: Any = target
    for key in parts[:-1]:
        existing = cursor.get(key) if isinstance(cursor, dict) else None
        if not isinstance(existing, dict):
            existing = {}
            cursor[key] = existing
        cursor = existing
    if not isinstance(cursor, dict):
        raise ValueError(f"cannot set {path!r}: parent of leaf is not an object")
    cursor[parts[-1]] = value


def _get_path(target: Any, path: str) -> Any:
    parts = path.split(".")
    cursor: Any = target
    for key in parts:
        if not isinstance(cursor, dict):
            return None
        cursor = cursor.get(key)
        if cursor is None:
            return None
    return cursor


def apply_overlay(extracted: dict[str, Any], edits: dict[str, Any]) -> dict[str, Any]:
    """Return a new dict: deep copy of `extracted` with `edits` applied.

    `edits` maps `field_path` → edited value. The original input is not
    mutated.
    """
    out = copy.deepcopy(extracted)
    for path, value in edits.items():
        _set_path(out, path, value)
    return out


def get_at_path(extracted: dict[str, Any], path: str) -> Any:
    """Read the current value at a dotted `field_path` (or None)."""
    return _get_path(extracted, path)
