"""Document extractor API — single FastAPI entry point."""

import hashlib
import os
import time
from datetime import datetime

import google.generativeai as genai
from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from pdf2image import convert_from_bytes

from config import (
    GOOGLE_API_KEY, PDFS_DIR, ALLOWED_ORIGINS,
    DEFAULT_OCR_ENGINE, DEFAULT_CONFIDENCE_THRESHOLD,
    MAX_OLLAMA_CONTEXT_CHARS,
)
from prompt_template import (
    DOCUMENT_DETECTION_TEMPLATE,
    DELIVERY_ORDER_TEMPLATE,
    WEIGHING_BILL_TEMPLATE,
    INVOICE_TEMPLATE,
    MIXED_DOCUMENT_TEMPLATE,
)
from ocr import (
    perform_ocr_tesseract, perform_ocr_paddleocr, perform_ocr_ppstructure,
    TESSERACT_AVAILABLE, PADDLEOCR_AVAILABLE, PPSTRUCTURE_AVAILABLE,
)
from table_extraction import (
    extract_tables_from_pdf, reconstruct_table_as_markdown,
    analyze_table_structure, clean_cell_content,
)
from json_extraction import extract_and_validate_json
from ai_model import create_ai_model

# Configure Gemini
genai.configure(api_key=GOOGLE_API_KEY)

app = FastAPI(title="Document Extractor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Document type detection ---

_DO_KEYWORDS = ["delivery order", "d/o", "delivered to", "sold to", "delivery date"]
_TIN_KEYWORDS = ["tax identification", "tin", "t.i.n", "identification number"]
_INVOICE_KEYWORDS = ["invoice", "invoice number", "bill to", "amount due", "total amount"]
_WEIGHING_KEYWORDS = ["weighing", "tare weight", "gross weight", "net weight", "weighing no"]


def detect_document_type(text: str) -> dict:
    """Classify document as delivery_order, invoice, and/or weighing_bill."""
    text_lower = text.lower()
    detected = []

    do_count = sum(1 for kw in _DO_KEYWORDS if kw in text_lower)
    if do_count > 0:
        detected.append(("delivery_order", do_count))

    # Invoice requires BOTH invoice keywords AND TIN
    has_invoice = any(kw in text_lower for kw in _INVOICE_KEYWORDS)
    has_tin = any(kw in text_lower for kw in _TIN_KEYWORDS)
    if has_invoice and has_tin:
        score = (
            sum(1 for kw in _INVOICE_KEYWORDS if kw in text_lower)
            + sum(1 for kw in _TIN_KEYWORDS if kw in text_lower)
        )
        detected.append(("invoice", score))

    weighing_count = sum(1 for kw in _WEIGHING_KEYWORDS if kw in text_lower)
    if weighing_count > 0:
        detected.append(("weighing_bill", weighing_count))

    if not detected:
        detected = [("delivery_order", 1)]

    detected.sort(key=lambda x: x[1], reverse=True)
    return {
        "detected_types": [d[0] for d in detected],
        "is_mixed": len(detected) > 1,
    }


def select_template(doc_type: str) -> str:
    """Return the appropriate prompt template for a document type."""
    templates = {
        "delivery_order": DELIVERY_ORDER_TEMPLATE,
        "weighing_bill": WEIGHING_BILL_TEMPLATE,
        "invoice": INVOICE_TEMPLATE,
    }
    return templates.get(doc_type, MIXED_DOCUMENT_TEMPLATE)


# --- PDF text extraction pipeline ---

OCR_MODEL_MAP = {
    "1": ("paddleocr", "PaddleOCR"),
    "2": ("tesseract", "Tesseract"),
    "3": ("ppstructure", "PaddleOCR PP-Structure"),
}


def _run_ocr(engine: str, filepath: str, images: list | None, threshold: float) -> str:
    """Dispatch to the correct OCR engine with fallback chain."""
    if engine == "ppstructure":
        if PPSTRUCTURE_AVAILABLE:
            return perform_ocr_ppstructure(filepath, threshold)
        engine = "paddleocr"  # fallback

    if engine == "paddleocr":
        if images is None:
            images = convert_from_bytes(open(filepath, 'rb').read())
        if PADDLEOCR_AVAILABLE:
            return perform_ocr_paddleocr(images, threshold)
        engine = "tesseract"  # fallback

    # tesseract
    if images is None:
        images = convert_from_bytes(open(filepath, 'rb').read())
    if TESSERACT_AVAILABLE:
        return perform_ocr_tesseract(images, threshold)

    return ""


def extract_text_from_pdf(filepath: str, ocr_model: str = None, confidence_threshold: float = None) -> tuple[str, dict]:
    """
    Extract text from PDF using direct text, table extraction, and OCR.

    Returns (extracted_text, tables_data).
    """
    extracted_text = ""

    # Step 1: Direct text extraction (searchable PDFs)
    try:
        reader = PdfReader(filepath)
        direct_text = "\n\n".join(p.extract_text() or "" for p in reader.pages)
        if direct_text.strip():
            extracted_text = direct_text
    except Exception:
        pass

    # Step 2: Table extraction via pdfplumber
    tables_data = extract_tables_from_pdf(filepath)
    if tables_data:
        for page_num, tables_list in tables_data.items():
            table_text = f"\n\n[TABLE DATA - Page {page_num}]\n"
            for table_idx, table in enumerate(tables_list, 1):
                rows = len(table)
                cols = max(len(r) for r in table) if table else 0
                table_text += f"\nTable {table_idx}: ({rows} rows x {cols} columns)\n"
                table_text += "```\n" + reconstruct_table_as_markdown(table) + "\n```\n"
            extracted_text += table_text

    # Step 3: OCR (if direct text is insufficient)
    if not extracted_text.strip() or len(extracted_text.strip()) < 100:
        engine_key = ocr_model if ocr_model in OCR_MODEL_MAP else None
        engine = OCR_MODEL_MAP[engine_key][0] if engine_key else DEFAULT_OCR_ENGINE
        threshold = confidence_threshold if confidence_threshold is not None else DEFAULT_CONFIDENCE_THRESHOLD

        ocr_text = _run_ocr(engine, filepath, None, threshold)
        if ocr_text.strip():
            extracted_text += ocr_text

    return extracted_text, tables_data


# --- Token counting helper ---

def _get_token_usage(answer, provider: str, model_name: str, context: str, response_text: str) -> dict:
    """Extract token usage from LLM response metadata, with Gemini API fallback."""
    usage = {"input_tokens": 0, "output_tokens": 0}

    # Try response metadata
    for attr in ('response_metadata', 'usage_metadata'):
        meta = getattr(answer, attr, None)
        if not meta:
            continue
        if isinstance(meta, dict):
            src = meta.get('usage_metadata', meta)
        else:
            src = meta
        if isinstance(src, dict):
            usage["input_tokens"] = (
                src.get('prompt_token_count') or src.get('input_tokens')
                or src.get('promptTokenCount') or 0
            )
            usage["output_tokens"] = (
                src.get('candidates_token_count') or src.get('completion_token_count')
                or src.get('output_tokens') or src.get('candidatesTokenCount') or 0
            )
        if usage["input_tokens"] or usage["output_tokens"]:
            return usage

    # Fallback: Gemini count_tokens API (cloud only)
    if provider == "cloud":
        try:
            model_for_counting = genai.GenerativeModel(model_name)
            if not usage["input_tokens"]:
                usage["input_tokens"] = model_for_counting.count_tokens(context).total_tokens
            if not usage["output_tokens"]:
                usage["output_tokens"] = model_for_counting.count_tokens(response_text).total_tokens
        except Exception:
            pass

    return usage


# --- API endpoints ---

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "document-extractor",
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/upload_pdf")
async def upload_pdf(
    file: UploadFile,
    provider: str = Form(default="cloud"),
    model: str = Form(default="gemini-2.0-flash"),
    ocr_model: str = Form(default="2"),
    confidence_score: int = Form(default=90),
):
    """Upload and parse a PDF document using OCR + AI."""
    try:
        start_time = time.time()

        selected_provider = provider
        selected_model = model
        selected_ocr_model = ocr_model
        selected_confidence = confidence_score

        confidence_threshold = selected_confidence / 100.0

        _, ocr_model_name = OCR_MODEL_MAP.get(selected_ocr_model, (None, "Unknown"))

        # Save file
        filepath = os.path.join(PDFS_DIR, file.filename)
        with open(filepath, "wb") as f:
            f.write(await file.read())

        # Extract text
        text, tables_data = extract_text_from_pdf(filepath, selected_ocr_model, confidence_threshold)

        if not text.strip():
            return {"status": "error", "message": "No extractable text found in PDF."}

        # Detect document type
        doc_analysis = detect_document_type(text)

        # Chunk text
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500, chunk_overlap=200, add_start_index=True,
        )
        chunks = splitter.split_text(text)
        context = "\n\n".join(chunks)

        # Truncate for Ollama safety
        if selected_provider == "local" and len(context) > MAX_OLLAMA_CONTEXT_CHARS:
            context = context[:MAX_OLLAMA_CONTEXT_CHARS]

        # Metadata
        file_id = hashlib.md5(file.filename.encode()).hexdigest()[:8]
        file_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
        file_metadata = {
            "creation_date": datetime.now().isoformat(),
            "last_modified": datetime.now().isoformat(),
            "detected_types": doc_analysis['detected_types'],
            "is_mixed": doc_analysis['is_mixed'],
        }

        # Select template
        if doc_analysis['is_mixed']:
            template_str = MIXED_DOCUMENT_TEMPLATE
        else:
            template_str = select_template(doc_analysis['detected_types'][0])

        # Run AI
        prompt = ChatPromptTemplate.from_template(template_str)
        model_obj = create_ai_model(selected_provider, selected_model)
        chain = prompt | model_obj
        answer = chain.invoke({"context": context})

        response_text = answer.content if hasattr(answer, "content") else str(answer)

        # Parse JSON
        parsed_data = extract_and_validate_json(response_text)
        if not parsed_data:
            return {
                "status": "error",
                "message": "Failed to extract valid JSON from model response.",
                "debug_info": {
                    "model": selected_model,
                    "provider": selected_provider,
                    "response_length": len(response_text),
                    "response_preview": response_text[:3000],
                },
            }

        processing_time = time.time() - start_time
        token_usage = _get_token_usage(answer, selected_provider, selected_model, context, response_text)

        return {
            "status": "ok",
            "parsed_info": parsed_data,
            "document_analysis": doc_analysis,
            "chunks_indexed": len(chunks),
            "file_id": file_id,
            "file_hash": file_hash,
            "file_metadata": file_metadata,
            "provider_used": selected_provider,
            "model_used": selected_model,
            "ocr_model": selected_ocr_model,
            "ocr_model_name": ocr_model_name,
            "confidence_score": selected_confidence,
            "token_usage": token_usage,
            "processing_time": round(processing_time, 2),
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
