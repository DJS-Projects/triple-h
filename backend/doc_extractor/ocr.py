"""
OCR engines: Tesseract, PaddleOCR, and PP-Structure.

Each engine follows the same contract:
  - Takes images (or filepath for PP-Structure) and a confidence threshold
  - Returns extracted text as a string
"""

import os

from config import DEFAULT_CONFIDENCE_THRESHOLD
from text_processing import postprocess_ocr_text

# Disable PaddleOCR model source check
os.environ["DISABLE_MODEL_SOURCE_CHECK"] = "True"
# Workaround for PaddlePaddle 3.3 CPU/OneDNN PIR bug
# https://github.com/PaddlePaddle/Paddle/issues/77340
os.environ["FLAGS_enable_pir_api"] = "0"  # noqa: SIM112 — PaddlePaddle requires this exact casing

# --- Optional dependency imports ---

try:
    import pytesseract
    from PIL import Image  # noqa: F401

    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

try:
    import cv2
    import numpy as np
    from paddleocr import PaddleOCR, PPStructureV3

    PADDLEOCR_AVAILABLE = True
    PPSTRUCTURE_AVAILABLE = True
except ImportError:
    try:
        import cv2
        import numpy as np
        from paddleocr import PaddleOCR

        PADDLEOCR_AVAILABLE = True
        PPSTRUCTURE_AVAILABLE = False
    except Exception:
        PADDLEOCR_AVAILABLE = False
        PPSTRUCTURE_AVAILABLE = False

# Lazy-initialized singletons
_paddle_ocr = None
_pp_structure = None


def is_handwritten_text(text: str, confidence: float, threshold: float) -> bool:
    """Detect if OCR text is likely handwritten based on confidence and heuristics."""
    if not text or not text.strip():
        return False
    text_stripped = text.strip()

    if confidence < threshold:
        return True
    if len(text_stripped) <= 2:
        return True

    handwritten_keywords = [
        "sign",
        "signature",
        "initial",
        "date",
        "checked by",
        "prepared by",
        "authorised",
    ]
    return any(kw in text_stripped.lower() for kw in handwritten_keywords)


def _filter_by_confidence(items, scores, threshold):
    """Filter OCR items by confidence threshold, returning kept items and scores."""
    kept_items, kept_scores = [], []
    for text, score in zip(items, scores, strict=False):
        text_str = str(text).strip() if text else ""
        if text_str and not is_handwritten_text(text_str, score, threshold):
            kept_items.append(text_str)
            kept_scores.append(score)
    return kept_items, kept_scores


def perform_ocr_tesseract(images: list, confidence_threshold: float | None = None) -> str:
    """Perform OCR using Tesseract on a list of PIL images."""
    if not TESSERACT_AVAILABLE:
        return ""

    threshold = confidence_threshold if confidence_threshold is not None else DEFAULT_CONFIDENCE_THRESHOLD
    ocr_text = ""

    for idx, image in enumerate(images, 1):
        try:
            ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            items, scores = [], []
            for i, word in enumerate(ocr_data["text"]):
                word_str = str(word).strip() if word else ""
                conf = int(ocr_data["conf"][i]) / 100.0 if i < len(ocr_data["conf"]) else 0.0
                if word_str:
                    items.append(word_str)
                    scores.append(conf)

            kept, _ = _filter_by_confidence(items, scores, threshold)
            if kept:
                page_text = "\n".join(kept)
                ocr_text += f"\n\n[Page {idx}]\n{page_text}\n"
        except Exception as e:
            print(f"Tesseract OCR failed on page {idx}: {e}")
            continue

    return postprocess_ocr_text(ocr_text) if ocr_text else ""


def perform_ocr_paddleocr(images: list, confidence_threshold: float | None = None) -> str:
    """Perform OCR using PaddleOCR on a list of PIL images."""
    global _paddle_ocr

    if not PADDLEOCR_AVAILABLE:
        return ""

    threshold = confidence_threshold if confidence_threshold is not None else DEFAULT_CONFIDENCE_THRESHOLD

    if _paddle_ocr is None:
        _paddle_ocr = PaddleOCR(use_textline_orientation=True, lang="en")

    ocr_text = ""

    for idx, pil_image in enumerate(images, 1):
        try:
            cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            results = _paddle_ocr.ocr(cv_image)

            if not results or not results[0]:
                continue

            ocr_result = results[0]
            items, scores = [], []

            # Handle newer PaddleOCR versions with .json attribute
            if hasattr(ocr_result, "json"):
                json_data = ocr_result.json
                if "res" in json_data and "rec_texts" in json_data["res"]:
                    rec_texts = json_data["res"]["rec_texts"]
                    rec_scores = json_data["res"].get("rec_scores", [])
                    if isinstance(rec_texts, list):
                        for i, text in enumerate(rec_texts):
                            score = float(rec_scores[i]) if i < len(rec_scores) and rec_scores[i] is not None else 0.0
                            items.append(text)
                            scores.append(score)

            kept, _ = _filter_by_confidence(items, scores, threshold)
            if kept:
                page_text = "\n".join(kept)
                ocr_text += f"\n\n[Page {idx}]\n{page_text}\n"
        except Exception as e:
            print(f"PaddleOCR failed on page {idx}: {e}")
            continue

    return postprocess_ocr_text(ocr_text) if ocr_text else ""


def perform_ocr_ppstructure(filepath: str, confidence_threshold: float | None = None) -> str:
    """Perform OCR using PaddleOCR PP-Structure for layout-aware extraction."""
    global _pp_structure

    if not PPSTRUCTURE_AVAILABLE:
        return ""

    from pdf2image import convert_from_bytes

    ocr_text = ""

    try:
        if _pp_structure is None:
            _pp_structure = PPStructureV3(
                lang="en",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
            )

        with open(filepath, "rb") as f:
            pdf_images = convert_from_bytes(f.read())

        for page_num, pil_image in enumerate(pdf_images, 1):
            try:
                cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
                result = _pp_structure.predict(input=cv_image)

                if not result or not result[0]:
                    continue

                res = result[0]
                page_parts = []

                if hasattr(res, "json"):
                    json_data = res.json

                    # Extract structured blocks (tables, text blocks)
                    if "res" in json_data and "parsing_res_list" in json_data["res"]:
                        for block in json_data["res"]["parsing_res_list"]:
                            if isinstance(block, dict):
                                content = block.get("block_content", "")
                                if content:
                                    page_parts.append(content)

                    # Extract raw OCR text
                    if "res" in json_data and "overall_ocr_res" in json_data["res"]:
                        overall_ocr = json_data["res"]["overall_ocr_res"]
                        if "rec_texts" in overall_ocr:
                            rec_texts = overall_ocr["rec_texts"]
                            rec_scores = overall_ocr.get("rec_scores", [])
                            for i, text in enumerate(rec_texts):
                                if text and isinstance(text, str) and text.strip():
                                    score = rec_scores[i] if i < len(rec_scores) else 0.0
                                    if score > 0.3:
                                        page_parts.append(text.strip())

                if page_parts:
                    ocr_text += f"\n\n[Page {page_num}]\n" + "\n".join(page_parts) + "\n"

            except Exception as e:
                print(f"PP-Structure failed on page {page_num}: {e}")
                continue

    except Exception as e:
        print(f"PP-Structure processing failed: {e}")

    return ocr_text
