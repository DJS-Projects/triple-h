"""Stage tracer for /extract/structured pipeline.

Runs INSIDE the backend container. Mirrors the production pipeline
piece-by-piece, dumps every artifact (Chandra raw response, chunks,
DoclingDocument, page PNGs, LLM input/output, token usage, per-stage
timings) to a versioned dir.

Usage (from host):
    docker compose exec backend uv run python /app/shared-data/_tracer.py \
        /app/tests_eval/fixtures/delivery_orders/coltron_sintari.pdf \
        --doc-type delivery_order \
        --model vision-primary \
        [--step]

Outputs land in /app/shared-data/traces/<run-id>/ (visible on host at
./local-shared-data/traces/<run-id>/).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import pdb
import sys
import time
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

# Ensure /app is on sys.path so `app.*` imports resolve when invoked from
# /app/shared-data/. uvicorn does this implicitly via its working dir.
if "/app" not in sys.path:
    sys.path.insert(0, "/app")

from pdf2image import convert_from_bytes
from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.config import settings
from app.services.chandra_ocr import convert_bytes_with_chunks_async
from app.services.docling_adapter import chunks_to_docling_document
from app.services.extraction import (
    _MAX_IMAGES_PER_REQUEST,
    _PROMPT_BY_TYPE,
    _SCHEMA_BY_TYPE,
    DocType,
    _is_vision_model,
)


def _maybe_step(label: str, ctx: dict, step_enabled: bool) -> None:
    if not step_enabled:
        return
    print(f"\n[STEP] {label}", file=sys.stderr)
    print(f"  Locals: {list(ctx.keys())}", file=sys.stderr)
    pdb.set_trace()


async def trace(
    pdf_path: Path,
    *,
    doc_type: DocType,
    model: str,
    dpi: int,
    step: bool,
) -> Path:
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    out_dir = Path("/app/shared-data/traces") / f"{run_id}_{pdf_path.stem}_{doc_type}"
    out_dir.mkdir(parents=True, exist_ok=True)

    timings: dict[str, float] = {}
    overall_start = time.perf_counter()

    pdf_bytes = pdf_path.read_bytes()
    (out_dir / "input.pdf").write_bytes(pdf_bytes)
    print(f"[trace] run_id={run_id}  out={out_dir}")
    print(f"[trace] input={pdf_path.name} bytes={len(pdf_bytes)}")
    _maybe_step("after_read_input", locals(), step)

    # Stage 1: Chandra convert(chunks)
    chandra_start = time.perf_counter()
    chandra_result = await convert_bytes_with_chunks_async(pdf_bytes, pdf_path.name)
    timings["chandra_seconds"] = time.perf_counter() - chandra_start

    if not chandra_result.success:
        (out_dir / "chandra_error.txt").write_text(str(chandra_result.error))
        raise RuntimeError(f"Chandra failed: {chandra_result.error}")

    if chandra_result.markdown:
        (out_dir / "chandra_markdown.md").write_text(chandra_result.markdown)
    if isinstance(chandra_result.chunks, dict):
        (out_dir / "chandra_chunks.json").write_text(
            json.dumps(chandra_result.chunks, indent=2, default=str)
        )
    (out_dir / "chandra_meta.json").write_text(
        json.dumps(
            {
                "success": chandra_result.success,
                "page_count": chandra_result.page_count,
                "checkpoint_id": chandra_result.checkpoint_id,
                "runtime": chandra_result.runtime,
                "cost_breakdown": chandra_result.cost_breakdown,
            },
            indent=2,
            default=str,
        )
    )
    print(
        f"[trace] chandra: {timings['chandra_seconds']:.2f}s  "
        f"page_count={chandra_result.page_count}  "
        f"chunks={len((chandra_result.chunks or {}).get('blocks', []))}"
    )
    _maybe_step("after_chandra", locals(), step)

    # Stage 2: build DoclingDocument from chunks
    docling_start = time.perf_counter()
    docling_doc = chunks_to_docling_document(
        chandra_result.chunks,
        name=pdf_path.name,
        page_count=chandra_result.page_count,
    )
    timings["docling_adapter_seconds"] = time.perf_counter() - docling_start

    docling_dict = docling_doc.export_to_dict(
        mode="json", exclude_none=True, coord_precision=2
    )
    (out_dir / "docling_document.json").write_text(
        json.dumps(docling_dict, indent=2, default=str)
    )
    markdown_view = docling_doc.export_to_markdown()
    (out_dir / "docling_markdown.md").write_text(markdown_view)
    print(
        f"[trace] docling adapter: {timings['docling_adapter_seconds']:.2f}s  "
        f"texts={len(docling_doc.texts or [])} tables={len(docling_doc.tables or [])} "
        f"pictures={len(docling_doc.pictures or [])} pages={len(docling_doc.pages or {})}"
    )
    _maybe_step("after_docling", locals(), step)

    # Stage 3: render page images (vision models only)
    page_pngs: list[BinaryContent] = []
    if _is_vision_model(model):
        pdf2img_start = time.perf_counter()
        images = await asyncio.to_thread(convert_from_bytes, pdf_bytes, dpi=dpi)
        for idx, img in enumerate(images, start=1):
            buf = BytesIO()
            img.save(buf, format="PNG")
            png_bytes = buf.getvalue()
            (out_dir / f"page_{idx:03d}.png").write_bytes(png_bytes)
            page_pngs.append(BinaryContent(data=png_bytes, media_type="image/png"))
        timings["pdf2image_seconds"] = time.perf_counter() - pdf2img_start
        print(
            f"[trace] pdf2image: {timings['pdf2image_seconds']:.2f}s  "
            f"pages={len(page_pngs)}  dpi={dpi}"
        )
    else:
        print("[trace] pdf2image: skipped (non-vision model)")
    _maybe_step("after_pdf2image", locals(), step)

    # Stage 4: build LLM input + call
    schema = _SCHEMA_BY_TYPE[doc_type]
    prompt_intro = _PROMPT_BY_TYPE[doc_type]
    capped_pngs = page_pngs[:_MAX_IMAGES_PER_REQUEST]

    user_message: list = [
        prompt_intro,
        f"\nOCR markdown (derived from DoclingDocument; full document text):\n\n{markdown_view}",
        *capped_pngs,
    ]
    llm_input_text = "\n---\n".join(m for m in user_message if isinstance(m, str))
    (out_dir / "llm_input.txt").write_text(llm_input_text)
    (out_dir / "llm_input_meta.json").write_text(
        json.dumps(
            {
                "doc_type": doc_type,
                "model": model,
                "schema": schema.__name__,
                "prompt_intro": prompt_intro,
                "image_count": len(capped_pngs),
                "image_count_total_before_cap": len(page_pngs),
                "max_images_per_request": _MAX_IMAGES_PER_REQUEST,
            },
            indent=2,
        )
    )
    _maybe_step("before_llm_call", locals(), step)

    llm_start = time.perf_counter()
    llm_model_obj = OpenAIChatModel(
        model,
        provider=OpenAIProvider(
            base_url=settings.LITELLM_BASE_URL,
            api_key=settings.LITELLM_MASTER_KEY,
        ),
    )
    agent: Agent = Agent(llm_model_obj, output_type=PromptedOutput(schema))
    run = await agent.run(user_message)
    timings["llm_seconds"] = time.perf_counter() - llm_start

    extracted = run.output.model_dump()
    (out_dir / "llm_output.json").write_text(json.dumps(extracted, indent=2))

    # Capture pydantic-ai usage info if available
    try:
        usage = run.usage()
        (out_dir / "llm_usage.json").write_text(
            json.dumps(
                {
                    "input_tokens": getattr(usage, "input_tokens", None),
                    "output_tokens": getattr(usage, "output_tokens", None),
                    "total_tokens": getattr(usage, "total_tokens", None),
                    "details": getattr(usage, "details", None),
                },
                indent=2,
                default=str,
            )
        )
    except Exception as exc:  # noqa: BLE001
        (out_dir / "llm_usage_error.txt").write_text(str(exc))

    print(f"[trace] llm: {timings['llm_seconds']:.2f}s  model={model}")
    _maybe_step("after_llm", locals(), step)

    timings["total_seconds"] = time.perf_counter() - overall_start
    (out_dir / "timings.json").write_text(json.dumps(timings, indent=2))
    print(f"[trace] total: {timings['total_seconds']:.2f}s")
    print(f"[trace] artifacts: {out_dir}")

    return out_dir


def main() -> int:
    ap = argparse.ArgumentParser(description="Stage tracer for /extract/structured")
    ap.add_argument("pdf", type=Path, help="Path to input PDF (in container)")
    ap.add_argument(
        "--doc-type",
        choices=["delivery_order", "weighing_bill", "invoice", "petrol_bill"],
        default="delivery_order",
    )
    ap.add_argument("--model", default="vision-primary")
    ap.add_argument("--dpi", type=int, default=150)
    ap.add_argument(
        "--step",
        action="store_true",
        help="Drop into pdb between stages",
    )
    args = ap.parse_args()

    if not args.pdf.exists():
        print(f"PDF not found: {args.pdf}", file=sys.stderr)
        return 2

    out_dir = asyncio.run(
        trace(
            args.pdf,
            doc_type=args.doc_type,
            model=args.model,
            dpi=args.dpi,
            step=args.step,
        )
    )
    print(f"\nDone. Artifacts: {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
