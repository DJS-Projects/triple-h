#!/usr/bin/env python3
"""CLI to generate ground truth fixture files from the current pipeline.

Usage:
    uv run python backend/tests/create_ground_truth.py path/to/file.pdf --type delivery_order

This runs the current extraction pipeline on the PDF and writes a draft
.expected.json file next to the fixture PDF for human review and correction.
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# Add the doc_extractor module to the path
sys.path.insert(0, str(Path(__file__).parent.parent / "doc_extractor"))


def main():
    parser = argparse.ArgumentParser(
        description="Generate ground truth fixture from PDF"
    )
    parser.add_argument("pdf_path", type=Path, help="Path to the PDF file")
    parser.add_argument(
        "--type",
        choices=["delivery_order", "invoice", "weighing_bill", "petrol_bill"],
        required=True,
        help="Document type",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory (default: fixtures/{type}s/)",
    )
    args = parser.parse_args()

    if not args.pdf_path.exists():
        print(f"Error: {args.pdf_path} not found")
        sys.exit(1)

    # Import pipeline components
    from app import detect_document_type, extract_text_from_pdf, select_template
    from json_extraction import extract_and_validate_json

    print(f"Extracting text from {args.pdf_path}...")
    text, tables = extract_text_from_pdf(str(args.pdf_path))

    if not text.strip():
        print("Error: No text extracted from PDF")
        sys.exit(1)

    doc_analysis = detect_document_type(text)
    print(f"Detected types: {doc_analysis['detected_types']}")

    # Try running through the LLM if API key is available
    extracted_data = None
    try:
        from ai_model import create_ai_model
        from config import DEFAULT_MODEL, DEFAULT_PROVIDER
        from langchain_core.prompts import ChatPromptTemplate
        from prompt_template import MIXED_DOCUMENT_TEMPLATE

        if doc_analysis["is_mixed"]:
            template_str = MIXED_DOCUMENT_TEMPLATE
        else:
            template_str = select_template(doc_analysis["detected_types"][0])

        prompt = ChatPromptTemplate.from_template(template_str)
        model_obj = create_ai_model(DEFAULT_PROVIDER, DEFAULT_MODEL)
        chain = prompt | model_obj
        answer = chain.invoke({"context": text})
        response_text = answer.content if hasattr(answer, "content") else str(answer)
        extracted_data = extract_and_validate_json(response_text)
        print("LLM extraction successful")
    except Exception as e:
        print(f"LLM extraction failed (expected without API key): {e}")
        extracted_data = {"_placeholder": "Run with API key to populate"}

    # Build output
    output = {
        "_meta": {
            "source_pdf": args.pdf_path.name,
            "doc_type": args.type,
            "generated_at": datetime.now().isoformat(),
            "status": "DRAFT - NEEDS HUMAN REVIEW",
            "detected_types": doc_analysis["detected_types"],
        },
        **(extracted_data or {}),
    }

    # Determine output path
    if args.output_dir:
        out_dir = args.output_dir
    else:
        type_plural = args.type + "s" if not args.type.endswith("s") else args.type
        out_dir = Path(__file__).parent / "fixtures" / type_plural

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{args.pdf_path.stem}.expected.json"

    with open(out_path, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Written to {out_path}")
    print("IMPORTANT: Review and correct this file before using as ground truth!")


if __name__ == "__main__":
    main()
