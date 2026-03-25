import re


# Common OCR error corrections
_PHRASE_FIXES = {
    # Delivery Order variations
    r"\bdelivery\s*(?:ah|y|yr|y\s*)\s*order\b": "delivery order",
    r"\bdeli\s*very\s*order\b": "delivery order",
    r"\bdeliv\s*ery\s*order\b": "delivery order",
    r"\bd\s*[/\\]\s*o\b": "d/o",
    r"\bdo\s*number\b": "d/o number",
    # Invoice variations
    r"\btax\s*in\s*voice\b": "tax invoice",
    r"\bin\s*voice\b": "invoice",
    r"\binvoice\s*no\s*[:\s]*": "invoice no: ",
    # Common OCR word splits
    r"\bsolid\s*to\b": "sold to",
    r"\bsold\s+t\s+o\b": "sold to",
    r"\bdelivered\s*t\s*o\b": "delivered to",
    # Weight variations
    r"\bnet\s*wt\b": "net weight",
    r"\bgros\s*s\s*wt\b": "gross weight",
    r"\btare\s*wt\b": "tare weight",
    r"\bweighing\s*no\b": "weighing no",
    # Date/quantity
    r"\bdate\s*[:\s]*": "date: ",
    r"\bqty\s*[:\s]*": "qty: ",
    r"\bquantity\s*[:\s]*": "quantity: ",
}


def normalize_phrases(text: str) -> str:
    """Fix common OCR errors like 'delivery yorder' -> 'delivery order'."""
    t = text.lower()
    for pattern, replacement in _PHRASE_FIXES.items():
        t = re.sub(pattern, replacement, t, flags=re.IGNORECASE)
    return t


def postprocess_ocr_text(text: str, apply_normalization: bool = True) -> str:
    """Clean up raw OCR text: normalize phrases, fix spacing, remove artifacts."""
    if apply_normalization:
        text = normalize_phrases(text)

    # Fix spacing around punctuation
    text = re.sub(r'\s+([.,;:])', r'\1', text)
    text = re.sub(r'([.,;:])(?!\d)\s*', r'\1 ', text)

    # Clean excessive whitespace
    text = re.sub(r'\n\s*\n', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)

    # Remove leading zeros in numbers (but not in dates/paths)
    text = re.sub(r'(?<![.:\-/])\b0+([1-9])', r'\1', text)

    return text


def merge_fragmented_lines(ocr_results: list) -> list:
    """Merge OCR text fragments that belong on the same line based on spatial proximity."""
    if not ocr_results:
        return []

    merged = []
    i = 0

    while i < len(ocr_results):
        current_box, current_text, current_conf = ocr_results[i]

        try:
            current_y = [pt[1] for pt in current_box]
            current_y_center = (min(current_y) + max(current_y)) / 2
            current_x_max = max(pt[0] for pt in current_box)
            current_y_range = max(current_y) - min(current_y)

            merged_text = current_text
            merged_conf = current_conf
            j = i + 1

            while j < len(ocr_results):
                next_box, next_text, next_conf = ocr_results[j]
                next_y = [pt[1] for pt in next_box]
                next_y_center = (min(next_y) + max(next_y)) / 2
                next_x_min = min(pt[0] for pt in next_box)
                next_y_range = max(next_y) - min(next_y)

                vertical_distance = abs(current_y_center - next_y_center)
                vertical_threshold = max(current_y_range, next_y_range) * 0.5
                horizontal_gap = next_x_min - current_x_max

                if vertical_distance < vertical_threshold and 0 <= horizontal_gap < 30:
                    merged_text += " " + next_text
                    merged_conf = (merged_conf + next_conf) / 2
                    all_x = [pt[0] for pt in current_box] + [pt[0] for pt in next_box]
                    all_y = [pt[1] for pt in current_box] + [pt[1] for pt in next_box]
                    current_x_max = max(all_x)
                    current_y_center = (min(all_y) + max(all_y)) / 2
                    j += 1
                else:
                    break

            merged.append((current_box, merged_text, merged_conf))
            i = j

        except (IndexError, TypeError):
            merged.append(ocr_results[i])
            i += 1

    return merged
