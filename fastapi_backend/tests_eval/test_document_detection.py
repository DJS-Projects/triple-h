"""Tests for document type detection logic."""

import pytest

_DO_KEYWORDS = ["delivery order", "d/o", "delivered to", "sold to", "delivery date"]
_TIN_KEYWORDS = ["tax identification", "tin", "t.i.n", "identification number"]
_INVOICE_KEYWORDS = [
    "invoice",
    "invoice number",
    "bill to",
    "amount due",
    "total amount",
]
_WEIGHING_KEYWORDS = [
    "weighing",
    "tare weight",
    "gross weight",
    "net weight",
    "weighing no",
]


def detect_document_type(text: str) -> dict:
    text_lower = text.lower()
    detected = []

    do_count = sum(1 for kw in _DO_KEYWORDS if kw in text_lower)
    if do_count > 0:
        detected.append(("delivery_order", do_count))

    has_invoice = any(kw in text_lower for kw in _INVOICE_KEYWORDS)
    has_tin = any(kw in text_lower for kw in _TIN_KEYWORDS)
    if has_invoice and has_tin:
        score = sum(1 for kw in _INVOICE_KEYWORDS if kw in text_lower) + sum(
            1 for kw in _TIN_KEYWORDS if kw in text_lower
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


@pytest.mark.unit
class TestDetectDocumentType:
    def test_delivery_order_keywords(self):
        text = "This is a delivery order for steel bars. Sold to: ABC Corp."
        result = detect_document_type(text)
        assert "delivery_order" in result["detected_types"]
        assert not result["is_mixed"]

    def test_delivery_order_do_keyword(self):
        text = "D/O Number: 12345. Delivered to warehouse."
        result = detect_document_type(text)
        assert "delivery_order" in result["detected_types"]

    def test_invoice_requires_tin(self):
        text = "Invoice Number: INV-001. Tax Identification Number: 12345678."
        result = detect_document_type(text)
        assert "invoice" in result["detected_types"]

    def test_invoice_without_tin_not_detected(self):
        text = "Invoice Number: INV-001. Amount due: RM 500.00. Total amount: RM 500."
        result = detect_document_type(text)
        assert "invoice" not in result["detected_types"]
        assert "delivery_order" in result["detected_types"]

    def test_weighing_bill_keywords(self):
        text = "Weighing No: 202301011234. Gross weight: 15.50 t. Tare weight: 5.00 t. Net weight: 10.50 t."
        result = detect_document_type(text)
        assert "weighing_bill" in result["detected_types"]

    def test_mixed_do_and_weighing(self):
        text = (
            "Delivery Order D/O Number: 12345. Sold to: ABC Corp.\n"
            "Weighing No: 202301011234. Gross weight: 15.50 t. Tare weight: 5.00 t."
        )
        result = detect_document_type(text)
        assert result["is_mixed"]
        assert "delivery_order" in result["detected_types"]
        assert "weighing_bill" in result["detected_types"]

    def test_mixed_all_three(self):
        text = (
            "Delivery Order sold to ABC.\n"
            "Invoice number INV-001 Tax Identification Number TIN-123.\n"
            "Gross weight 10 t. Tare weight 5 t."
        )
        result = detect_document_type(text)
        assert result["is_mixed"]
        assert len(result["detected_types"]) == 3

    def test_empty_text_defaults_to_delivery_order(self):
        result = detect_document_type("")
        assert result["detected_types"] == ["delivery_order"]
        assert not result["is_mixed"]

    def test_garbage_text_defaults_to_delivery_order(self):
        result = detect_document_type("asdfghjkl random gibberish 12345")
        assert result["detected_types"] == ["delivery_order"]

    def test_priority_ordering(self):
        text = (
            "D/O number 123.\n"
            "Weighing no 456. Gross weight 10. Tare weight 5. Net weight 5."
        )
        result = detect_document_type(text)
        assert result["is_mixed"]
        assert result["detected_types"][0] == "weighing_bill"

    @pytest.mark.xfail(reason="Petrol bill detection not yet implemented")
    def test_petrol_bill_detection(self):
        text = "Petrol receipt. Diesel 40L. RON95 pump 3. Station: Petronas."
        result = detect_document_type(text)
        assert "petrol_bill" in result["detected_types"]
