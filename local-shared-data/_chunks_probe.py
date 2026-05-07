"""Probe Chandra `chunks` output across all 4 doc-type fixtures.

Builds a frequency table of block_types emitted, samples one of each,
and dumps full chunks JSON per fixture. Informs the docling_adapter
mapping table.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

if "/app" not in sys.path:
    sys.path.insert(0, "/app")


FIXTURES = [
    ("delivery_orders/coltron_sintari.pdf", "delivery_order"),
    ("delivery_orders/ds_steel.pdf", "delivery_order"),
    ("weighing_bills/alliance_steel_1.pdf", "weighing_bill"),
    ("invoices/arfi_8038.pdf", "invoice"),
    ("petrol_bills/bps7792_caltex.pdf", "petrol_bill"),
]


def main() -> int:
    from app.services.chandra_ocr import convert_with_chunks

    out_dir = Path("/app/shared-data/traces") / (
        datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S") + "_CHUNKS_PROBE"
    )
    out_dir.mkdir(parents=True, exist_ok=True)

    block_type_counts: Counter[str] = Counter()
    block_type_examples: dict[str, dict] = {}

    for rel, doc_type in FIXTURES:
        pdf = Path("/app/tests_eval/fixtures") / rel
        if not pdf.exists():
            print(f"  skip (missing): {rel}")
            continue
        print(f"\n=== {rel} ({doc_type}) ===")
        try:
            result = convert_with_chunks(str(pdf))
        except Exception as exc:  # noqa: BLE001
            print(f"  ERROR: {type(exc).__name__}: {exc}")
            continue

        chunks = result.chunks or {}
        blocks = chunks.get("blocks", []) if isinstance(chunks, dict) else []
        page_info = chunks.get("page_info") if isinstance(chunks, dict) else None
        metadata = chunks.get("metadata") if isinstance(chunks, dict) else None

        local_counts = Counter(b.get("block_type", "?") for b in blocks)
        block_type_counts.update(local_counts)
        for b in blocks:
            bt = b.get("block_type", "?")
            block_type_examples.setdefault(bt, b)

        print(
            f"  success={result.success}  pages={result.page_count}  blocks={len(blocks)}"
        )
        print(f"  block_types: {dict(local_counts)}")
        print(f"  checkpoint_id: {result.checkpoint_id}")
        print(f"  has page_info: {page_info is not None}")
        print(f"  has metadata: {metadata is not None}")

        # Persist
        stem = pdf.stem
        (out_dir / f"{doc_type}__{stem}__chunks.json").write_text(
            json.dumps(chunks, indent=2, default=str)
        )
        if result.markdown:
            (out_dir / f"{doc_type}__{stem}__markdown.md").write_text(result.markdown)
        # Lightweight metadata file
        meta = {
            "doc_type": doc_type,
            "fixture": rel,
            "page_count": result.page_count,
            "blocks": len(blocks),
            "block_types": dict(local_counts),
            "checkpoint_id": result.checkpoint_id,
            "runtime": result.runtime,
            "cost_breakdown": result.cost_breakdown,
        }
        (out_dir / f"{doc_type}__{stem}__meta.json").write_text(
            json.dumps(meta, indent=2)
        )

    print("\n=== AGGREGATE block_types across fixtures ===")
    for bt, count in block_type_counts.most_common():
        print(f"  {count:>4d}  {bt}")

    print("\n=== ONE EXAMPLE per block_type ===")
    examples_summary = {}
    for bt, sample in block_type_examples.items():
        keys_in_block = sorted(sample.keys())
        examples_summary[bt] = {
            "block_type": bt,
            "keys": keys_in_block,
            "id": sample.get("id"),
            "page": sample.get("page"),
            "has_polygon": "polygon" in sample,
            "has_bbox": "bbox" in sample,
            "html_preview": (sample.get("html") or "")[:140],
            "section_hierarchy": sample.get("section_hierarchy"),
        }
    print(json.dumps(examples_summary, indent=2, default=str))
    (out_dir / "block_type_examples.json").write_text(
        json.dumps(examples_summary, indent=2, default=str)
    )

    print(f"\nartifacts: {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
