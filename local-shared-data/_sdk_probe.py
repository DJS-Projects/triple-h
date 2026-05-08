"""Probe the datalab-python-sdk surface area.

Lists available client methods, model types, OCR endpoint capabilities.
"""

from __future__ import annotations

import inspect
import sys
import os

if "/app" not in sys.path:
    sys.path.insert(0, "/app")


def main() -> int:
    import datalab_sdk
    from datalab_sdk import AsyncDatalabClient, DatalabClient
    from datalab_sdk import models as sdk_models

    print(f"datalab_sdk: {datalab_sdk.__file__}")
    print(f"version: {getattr(datalab_sdk, '__version__', '?')}")
    print()

    print("=== DatalabClient methods ===")
    for name, member in inspect.getmembers(DatalabClient):
        if name.startswith("_"):
            continue
        if inspect.isfunction(member) or inspect.ismethod(member):
            sig = "?"
            try:
                sig = str(inspect.signature(member))
            except (ValueError, TypeError):
                pass
            print(f"  {name}{sig}")
    print()

    print("=== AsyncDatalabClient methods ===")
    for name, member in inspect.getmembers(AsyncDatalabClient):
        if name.startswith("_"):
            continue
        if (
            inspect.isfunction(member)
            or inspect.iscoroutinefunction(member)
            or inspect.ismethod(member)
        ):
            sig = "?"
            try:
                sig = str(inspect.signature(member))
            except (ValueError, TypeError):
                pass
            print(f"  {name}{sig}")
    print()

    print("=== sdk.models exports ===")
    for name in sorted(dir(sdk_models)):
        if name.startswith("_"):
            continue
        obj = getattr(sdk_models, name)
        if inspect.isclass(obj):
            print(f"  class {name}")
            # Show pydantic fields if it's a BaseModel
            fields = getattr(obj, "model_fields", None)
            if fields:
                for fname, finfo in fields.items():
                    print(f"      .{fname}: {finfo.annotation}")
    print()

    print("=== test convert call (env DATALAB_API_KEY required) ===")
    api_key = os.environ.get("DATALAB_API_KEY") or os.environ.get("CHANDRA_API_KEY")
    if not api_key:
        print("  no DATALAB_API_KEY / CHANDRA_API_KEY set; skipping live call")
        return 0
    print(f"  using API key: {api_key[:6]}...{api_key[-4:]}")

    pdf_path = "/app/tests_eval/fixtures/delivery_orders/coltron_sintari.pdf"
    client = DatalabClient(api_key=api_key)
    print(f"\n  calling convert({pdf_path}) ...")
    try:
        result = client.convert(pdf_path)
        print(f"  success={result.success}")
        print("  attrs:")
        for attr in [
            "markdown",
            "html",
            "json",
            "chunks",
            "segmentation_results",
            "extraction_schema_json",
            "checkpoint_id",
            "metadata",
            "images",
            "page_count",
            "runtime",
            "cost_breakdown",
            "error",
        ]:
            val = getattr(result, attr, "<missing>")
            if val is None or val == "":
                summary = "None/empty"
            elif isinstance(val, str):
                summary = f"str(len={len(val)})"
            elif isinstance(val, (list, dict)):
                try:
                    n = len(val)
                except TypeError:
                    n = "?"
                summary = f"{type(val).__name__}(len={n})"
            else:
                summary = f"{type(val).__name__}={val!r:.80}"
            print(f"    .{attr}: {summary}")

        # Check if `ocr` method exists (returns bbox)
        if hasattr(client, "ocr"):
            print("\n  client.ocr exists — testing")
            ocr_result = client.ocr(pdf_path)
            print(f"  ocr success={getattr(ocr_result, 'success', '?')}")
            for attr in dir(ocr_result):
                if attr.startswith("_") or callable(getattr(ocr_result, attr, None)):
                    continue
                val = getattr(ocr_result, attr)
                if val is None:
                    continue
                if isinstance(val, str):
                    print(f"    .{attr}: str(len={len(val)})")
                elif isinstance(val, list):
                    print(f"    .{attr}: list(len={len(val)})")
                    if val:
                        print(f"      sample: {repr(val[0])[:300]}")
                elif isinstance(val, dict):
                    print(f"    .{attr}: dict(keys={list(val.keys())[:8]})")
                else:
                    print(f"    .{attr}: {type(val).__name__} = {repr(val)[:120]}")
    except Exception as exc:  # noqa: BLE001
        print(f"  error: {type(exc).__name__}: {exc}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
