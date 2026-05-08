"""Probe Datalab OCROptions + payload to find quality knobs.

Inspects:
  - All fields on OCROptions / ProcessingOptions
  - What the SDK actually sends in the multipart form
  - Tries undocumented kwargs (model, mode, accurate, langs)
  - Compares ocr() vs convert(mode=accurate) text quality on the same fixture
"""

from __future__ import annotations

import dataclasses
import os
import sys
from pathlib import Path

if "/app" not in sys.path:
    sys.path.insert(0, "/app")


def main() -> int:
    from datalab_sdk import DatalabClient
    from datalab_sdk.models import (
        ConvertOptions,
        ExtractOptions,
        OCROptions,
        ProcessingOptions,
    )

    print("=== All processing-option dataclasses ===")
    for cls in (ProcessingOptions, OCROptions, ConvertOptions, ExtractOptions):
        print(f"\n  {cls.__name__}:")
        if dataclasses.is_dataclass(cls):
            for f in dataclasses.fields(cls):
                print(f"    .{f.name}: {f.type} = {f.default!r}")

    api_key = os.environ.get("DATALAB_API_KEY") or os.environ.get("CHANDRA_API_KEY")
    if not api_key:
        print("\nNo API key; skipping live probes.")
        return 0
    print(f"\nUsing API key: {api_key[:6]}...{api_key[-4:]}")

    pdf = Path("/app/tests_eval/fixtures/delivery_orders/coltron_sintari.pdf")
    client = DatalabClient(api_key=api_key)

    # 1. Default ocr() — capture all polygon+text we can
    print("\n=== ocr() default ===")
    r = client.ocr(str(pdf))
    page0 = r.pages[0] if r.pages else {}
    lines = page0.get("text_lines", []) if isinstance(page0, dict) else []
    print(f"  success={r.success}  lines={len(lines)}  status={r.status}")
    target_strings = [
        "MDX",
        "Lorry",
        "Lorrt",
        "lorry",
        "LORRY",
        "Hafiz",
        "DO-61",
        "PO2511",
    ]
    for t in target_strings:
        hits = [
            (round(line.get("confidence", 0), 3), line.get("text", ""))
            for line in lines
            if t.lower() in (line.get("text") or "").lower()
        ]
        if hits:
            print(f"  '{t}' →")
            for conf, text in hits:
                print(f"    [{conf}] {text!r}")

    # 2. Try ocr() with various extras hoping for hidden knobs
    print("\n=== probe: try undocumented options ===")
    for opts_kwargs in [
        {"langs": "English,Malay"},
        {"langs": "English"},
        {"use_llm": True},
        {"mode": "accurate"},
        {"model": "chandra"},
    ]:
        try:
            opts = (
                OCROptions(**opts_kwargs) if hasattr(OCROptions, "__init__") else None
            )
            print(f"  OCROptions({opts_kwargs}) constructible: {opts}")
        except TypeError as exc:
            print(f"  OCROptions({opts_kwargs}) → TypeError: {exc}")

    # 3. Inspect the form params the SDK actually sends for ocr()
    print("\n=== SDK form params for ocr() ===")
    try:
        params = client.get_form_params(file_path=str(pdf), require_file=False)
        print(f"  type: {type(params)}")
        if hasattr(params, "model_dump"):
            print(f"  fields: {params.model_dump()}")
        elif isinstance(params, dict):
            for k, v in params.items():
                print(f"  {k}: {repr(v)[:120]}")
        else:
            print(f"  repr: {params!r}")
    except Exception as exc:  # noqa: BLE001
        print(f"  error: {exc}")

    # 4. convert(mode=accurate) — does it produce richer JSON / chunks with bbox?
    print("\n=== convert(mode=accurate, output_format=chunks) ===")
    try:
        cr = client.convert(
            str(pdf),
            options=ConvertOptions(
                mode="accurate", output_format="chunks", add_block_ids=True
            ),
        )
        print(
            f"  success={cr.success}  format={cr.output_format}  page_count={cr.page_count}"
        )
        for attr in ("chunks", "json", "segmentation_results"):
            val = getattr(cr, attr, None)
            if val is None:
                print(f"  .{attr}: None")
                continue
            if isinstance(val, list):
                print(f"  .{attr}: list(len={len(val)})")
                if val:
                    print(f"    sample: {repr(val[0])[:400]}")
            elif isinstance(val, dict):
                print(f"  .{attr}: dict(keys={list(val.keys())[:6]})")
                print(f"    sample: {repr(val)[:400]}")
        # Check raw markdown quality
        md = cr.markdown or ""
        for t in ("MDX", "Lorry", "Hafiz"):
            for line in md.splitlines():
                if t.lower() in line.lower():
                    print(f"  md line: {line.strip()!r}")
                    break
    except Exception as exc:  # noqa: BLE001
        print(f"  error: {type(exc).__name__}: {exc}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
