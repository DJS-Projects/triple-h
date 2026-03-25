"""
Document Parsing Templates for AI Model

This module contains all the prompt templates used for parsing different document types:
- Delivery Orders
- Weighing Bills
- Invoices
- Mixed Documents

Each template provides specific instructions to the AI model for extracting structured data.
"""

# ==========================
# Templates for Different Document Types
# ==========================

DOCUMENT_DETECTION_TEMPLATE = """
Analyze the following document text and determine its type(s). The document may be:
1. Delivery Order (D/O) - contains delivery order number, sold to, delivered to information
2. Invoice - must contain tax identification number (TIN). consist word invoice doesn't mean is invoice, it must contain tax identification number (TIN) to be consider as invoice.
3. Weighing Bill - contains weighing information, net weight, tare weight, gross weight

Document text:
{context}

Respond in JSON format:
{{
  "document_types": ["delivery_order" | "invoice" | "weighing_bill"],
  "confidence": number (0-1),
  "reasons": [list of reasons]
}}
"""

DELIVERY_ORDER_TEMPLATE = """ 
You are a Delivery order parser. Extract all relevant data from the delivery order text below and output **strictly in JSON** following this schema.

The output must be compatible with the following model:

{{
  "D/O issuer name": str,
  "sold to": str,
  "sold to (address)": str,
  "delivered to": str,
  "delivered to (address)": str,
  "D/O number": [str],
  "P/O number": [str],
  "Vehicle number": [str],
  "date": [str],
  "items": [{{
    "description": str,
    "quantity": str,
    "weight_mt": str (weight in MT with 4 decimal places if available)
  }}],
  "total_quantity": str,
  "total_weight_mt": str,
  "good description": [str],
  "quantity": [str]
}}

Parsing instructions:
1. Extract all relevant data explicitly stated only in the delivery order (do not extract any information from invoice, weighing bill or outside sources).
1a. Extract "D/O issuer name" as the main company name that issued the delivery order (usually the company name at the top of the document or the supplier/issuer company).
2. Normalize all date values to ISO format (`YYYY-MM` or `YYYY-MM-DD`).
3. Lists must contain distinct elements (no duplicates).
4. Ensure phone numbers and emails are cleanly formatted.
5. Output must be a single valid JSON object only — no markdown, commentary, or explanations.
6. if the delivery order issued by Alliance Steel (M) Sdn Bhd, the PO number may cross 2 lines, (Sample PO no (if issued by Alliance Steel (M) Sdn Bhd only ): LXSKJ2025001-10-10-123), please ensure to capture the full PO number.
7. if the delivery order issued by Alliance Steel (M) Sdn Bhd, The Good description shall cross 3 columns in material description (Example : Steel Bar B500B 16mmx12m) please ensure to capture the full good description.
8. The delivery order may contain multiple rows of goods, please ensure to capture all good descriptions and quantities as lists.
9. **Item Details Extraction**: For each item row, extract:
   - description: Full description of the good/material (include unit information like MT, BDL, PCS in the description)
   - quantity: The quantity value
   - weight_mt: If weight in MT is mentioned, extract it with exactly 4 decimal places (e.g., "12.5 MT" → "12.5000")
10. **Totals Calculation**: 
   - total_quantity: Sum of all quantity values
   - total_weight_mt: Sum of all weights in MT with exactly 4 decimal places (e.g., "25.7500")
   - If total weight is not directly stated but weight per unit is mentioned (e.g., "0.999/MT" or "1.022/MT"), calculate: weight_per_unit × total_quantity = total_weight_mt (do not multiply if the quantity is already in MT).
11. For backward compatibility, also populate "good description" and "quantity" arrays with the same data.
12. OCR Text Recovery: If you encounter fragmented words or OCR artifacts (e.g., "delivery yorder", "in voice"), intelligently recover the intended words ("delivery order", "invoice").
Delivery order text:
{context}
"""

WEIGHING_BILL_TEMPLATE = """
You are a Weighing Bill parser. Extract all relevant data from the weighing bill text below and output **strictly in JSON** following this schema.

The output must be compatible with the following model:

{{
  "weighing_no": str,
  "contract_no": str,
  "vehicle_no": str,
  "gross_weight": str,
  "tare_weight": str,
  "net_weight": str,
  "off_weight": str,
  "actual_weight": str,
  "gross_time": str
}}

Parsing instructions:
1. Extract all relevant data explicitly stated only in the weighing bill (do not extract any information from delivery order, invoice or outside sources).
2. Normalize all date/time values to ISO format (`YYYY-MM` or `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`).
3. Weight values should be extracted as strings with their units (e.g., "1500 kg").
4. Lists must contain distinct elements (no duplicates).
5. Output must be a single valid JSON object only — no markdown, commentary, or explanations.
6. If weighing bill is from Alliance Steel, the weighing no shall be in format of 12 digits nummber (Example: 202301011234). 
7. If weighing bill is from Alliance Steel, the contract no shall in format: (Sample Cotract no: LXSKJ2025001-10).
8. The value must only in numbers with decimal and not consist any alphabet except the t stand for tonne at the back Example 12.34 t, 0.00 t, 7.23 t only. 
9. Must display all Gross weight, Tare weight, Net weight, Off weight, Actual weight even the value is 0.00.
10. The vehicle no shall be standard Malaysian vehicle number format (Example: WXY1234A, ABC1234), The front alphabet normally will not exceeding 3 characters, the number part will not exceeding 4 digits, is somecase there may be alphabet at the back of the number and it shall only maximum 1 character.
11. if there's confusion of vehicle number JWPS186 and JWP8186, please choose JWP8186 as the correct vehicle no.
12. OCR Text Recovery: If you encounter fragmented words or OCR artifacts (e.g., "net wt", "gros s wt"), intelligently recover the intended words ("net weight", "gross weight").
13. When returning company names and addresses, please ensure they are capital first letter of each word. in the company name and address. if part of the company name consist of only consonants letter, please capital each letter. (Example: "Abc Steel Sdn Bhd display it as ABC Steel Sdn Bhd", "Ds Steel Sdn Bhd display it as DS Steel Sdn Bhd").
14. In address part, after postal code, there shall be a space before the state name. (Example: "12345 Selangor").
15. If there is φ symbol in the description, it's the diameter symbol please display "⌀".
16. The PO number all alphabet shall be capital letters. (Example: LXSKJ2025001-10-10-123). The vehicle number all alphabet shall be capital letters. (Example: WXY1234A, ABC1234).
17. Company name list and addresses that may appear in the documents are as per below. Use this if the company name and address if you notice it's highly similar to the below list.:
GBI Mesh & Bar Trading Sdn. Bhd. 8, Lorong Bakap Indah 10, Taman Bakap Indah, 14200 Sungai Bakap, Pulau Pinang. Tel: 014-391 3419
Coltron Construction Sdn. Bhd. LOT 224 KWS Perindustrian Bukit Kayu Hitam, 06050 Bukit Kayu Hitam, Kedah.
EC Excel Wire Sdn. Bhd. Lot 77A & 77B, Lorong Gebeng 1/7, Gebeng Industrial Estate, 26080 Kuantan, Pahang.
Eng Soon Hardware Trading Sdn. Bhd. B-73, Jalan Sri Kemuning, Off Jalan Mentakab, 28000 Temerloh, Pahang.
Hillhome Builder Sdn. Bhd. DEL: Site LOT 2091, Mukim Bentong, Pahang.
18. If you come across company name like:
GBIMESH&BARTRADING SDN.BHD. Please show it as GBI Mesh & Bar Trading Sdn. Bhd.
Coltronconstructionsdn.bhd. Please show it as Coltron Construction Sdn. Bhd.
19. **CRITICAL OCR CHARACTER CORRECTION ALGORITHM**: For D/O numbers, P/O numbers, and all alphanumeric reference codes, you MUST correct ambiguous OCR characters using the date as reference. This is MANDATORY and HIGH PRIORITY.

Rules for character correction (apply these in order):
a) **Date-based correction (HIGHEST PRIORITY)**: If document contains a date, extract the month and year digits. Then scan all ID/reference numbers and replace ambiguous characters with the digits from the date.
   - Example: If date is 25/11/2025 (month=11, year=2025), then in any ID field containing "2S1l", replace S→5 and l→1 to get "2511"
   - Example: If date is 10/12/2024 and you see "PO1012", verify 1 and 0 are correct based on month(12) and year digits
   
b) **Character substitution priority**: When you encounter ambiguous characters in ID numbers, apply these substitutions:
   - S → 5 (especially in first 4-8 characters of codes where date patterns appear)
   - l (lowercase L) → 1
   - I (uppercase i) → 1
   - O (letter O) → 0 (in numeric sections)
   - Z → 2 (in numeric sections)
   - B → 8 (in numeric sections)
   - G → 6 (in numeric sections)
   
c) **Format validation**: After correction, verify the number follows expected format:
   - Alliance Steel P/O format: LXSKJ + 4-digit year-month + remaining digits (e.g., LXSKJ2025001-10-10-123)
   - Standard D/O format: Usually contains 4 consecutive digits representing YYMM or MMDD from the date
   
d) **MUST DO**: Always compare corrected result with the document date. If they don't align, re-examine and correct again.

Example corrections:
- OCR reads: "PO2S1l" + Date is "25/11/2025" → Correct to: "PO2511" (2=2✓, S→5, 1=1✓, l→1)
- OCR reads: "LXSKj202S001" + Date is "11/10/2025" → Correct to: "LXSKJ202S001" → "LXSKJ20251001" (S→5 based on date pattern)
- OCR reads: "DO1012A" + Date is "10/12/2025" → Verify: "10" (month), "12" (day), keep as "DO1012A" ✓

**CRITICAL REMINDER**: This character correction is not optional. You MUST apply it to ALL ID numbers, reference codes, P/O numbers, and D/O numbers in the document. Do NOT output ambiguous characters like 'S' instead of '5' or 'l' instead of '1' in any ID field.

Weighing bill text:
{context}
"""

INVOICE_TEMPLATE = """
You are an Invoice parser. Extract all relevant data from the invoice text below and output **strictly in JSON** following this schema.

The output must be compatible with the following model:

{{
  "invoice_number": str,
  "invoice_date": str,
  "bill_to": str,
  "ship_to": str,
  "items": [{{
    "description": str,
    "quantity": str,
    "unit_price": str,
    "amount": str
  }}],
  "subtotal": str,
  "tax": str,
  "total": str
}}

Parsing instructions:
1. Extract all relevant data explicitly stated only in the invoice (do not extract any information from delivery order, weighing bill or outside sources).
2. Normalize all date values to ISO format (`YYYY-MM` or `YYYY-MM-DD`).
3. Currency amounts should include the currency symbol (e.g., "$1,500.00").
4. Output must be a single valid JSON object only — no markdown, commentary, or explanations.
5. OCR Text Recovery: If you encounter fragmented words or OCR artifacts (e.g., "in voice"), intelligently recover the intended words ("invoice").

Invoice text:
{context}
"""

MIXED_DOCUMENT_TEMPLATE = """
You are analyzing a document that may contain multiple types of information (Delivery Order, Invoice, and/or Weighing Bill).

For each document type present, extract ONLY the information explicitly stated in that specific section. Do NOT cross-reference information between different document types.

Document text:
{context}

Extract and output in JSON format with the following structure:

{{
  "document_analysis": {{
    "detected_types": [list of "delivery_order", "invoice", "weighing_bill"],
    "pages_breakdown": {{
      "page_1": "document_type",
      "page_2": "document_type"
    }}
  }},
  "delivery_order_data": {{
    "D/O issuer name": str or null,
    "sold to": str or null,
    "sold to (address)": str or null,
    "delivered to": str or null,
    "delivered to (address)": str or null,
    "D/O number": [str] or [],
    "P/O number": [str] or [],
    "Vehicle number": [str] or [],
    "date": [str] or [],
    "items": [{{
      "description": str,
      "quantity": str,
      "weight_mt": str or null
    }}] or [],
    "total_quantity": str or null,
    "total_weight_mt": str or null,
    "good description": [str] or [],
    "quantity": [str] or []
  }},
  "weighing_bill_data": {{
    "weighing_no": str or null,
    "contract_no": str or null,
    "vehicle_no": str or null,
    "gross_weight": str or null,
    "tare_weight": str or null,
    "net_weight": str or null,
    "off_weight": str or null,
    "actual_weight": str or null,
    "gross_time": str or null
  }},
  "invoice_data": {{
    "invoice_number": str or null,
    "invoice_date": str or null,
    "bill_to": str or null,
    "ship_to": str or null,
    "items": [{{
      "description": str,
      "quantity": str,
      "unit_price": str,
      "amount": str
    }}] or [],
    "subtotal": str or null,
    "tax": str or null,
    "total": str or null
  }}
}}

Rules:
1. Only extract from the sections that contain each document type.
2. Do NOT merge or cross-reference data between delivery order, invoice, and weighing bill sections.
3. Normalize all dates to ISO format.
4. Return null for missing fields.
5. Return empty arrays for list fields with no data.
6. Output must be a single valid JSON object only — no markdown, commentary, or explanations.
7. if it's a delivery order page and the delivery order issued by Alliance Steel (M) Sdn Bhd, the PO number may cross 2 lines, (Sample PO no: LXSKJ2025001-10-10-123), please ensure to capture the full PO number.
7a. Extract "D/O issuer name" as the main company name that issued the delivery order (usually the company name at the top of the document or the supplier/issuer company name). This is NOT the "sold to" field.
8. if it's a delivery order page and the delivery order issued by Alliance Steel (M) Sdn Bhd, The Good description shall cross 3 columns in material description  (Example : Steel Bar B500B 16mmx12m) please ensure to capture the full description.
9. The delivery order may contain multiple rows of goods, please ensure to capture all good descriptions and quantities as lists.
9a. **Item Details Extraction for Delivery Orders**: For each item row in delivery order section, extract:
   - description: Full description of the good/material (include unit information like MT, BDL, PCS in the description)
   - quantity: The quantity value
   - weight_mt: If weight in MT is mentioned, extract it with exactly 4 decimal places (e.g., "12.5 MT" → "12.5000")
9b. **Totals Calculation for Delivery Orders**: 
   - total_quantity: Sum of all quantity values from items
   - total_weight_mt: Sum of all weights in MT with exactly 4 decimal places (e.g., "25.7500")
   - If total weight is not directly stated but weight per unit is mentioned (e.g., "0.999/MT" or "1.022/MT"), calculate: weight_per_unit × total_quantity = total_weight_mt
9c. For backward compatibility, also populate "good description" and "quantity" arrays.
10. For weighing bill section, if weighing bill is from Alliance Steel, the weighing no shall be in format of 12 digits nummber (Example: 202301011234). 
10. For weighing bill section, if weighing bill is from Alliance Steel, the contract no shall in format: (Sample Cotract no: LXSKJ2025001-10)
11. For weighing bill section, the value must only in numbers with decimal and not consist any alphabet except the t stand for tonne at the back Example 12.34 t, 0.00 t, 7.23 t only. After decimal there will be two more digits only. If there's more than 2 digits number after it's t (ie: 28.211 it should be 28.21 t). 
12. For weighing bill section, must display all Gross weight, Tare weight, Net weight, Off weight, Actual weight even the value is 0.00. 
13. The vehicle no shall be standard Malaysian vehicle number format (Example: WXY1234A, ABC1234), The front alphabet normally will not exceeding 3 characters, the number part will not exceeding 4 digits, is somecase there may be alphabet at the back of the number and it shall only maximum 1 character. The front alphabet is only word if the front word is 5k 1234 it should be SK 1234.
14. For weighing bill section, if there's confusion of vehicle number JWPS186 and JWP8186, please choose JWP8186 as the correct vehicle no.
15. OCR Text Recovery: If you encounter fragmented words or OCR artifacts, intelligently recover the intended words (e.g., "delivery yorder" → "delivery order", "in voice" → "invoice", "net wt" → "net weight").
16. When returning company names and addresses, please ensure they are capital first letter of each word. in the company name and address. if part of the company name consist of only consonants letter, please capital each letter. (Example: "Abc Steel Sdn Bhd display it as ABC Steel Sdn Bhd", "Ds Steel Sdn Bhd display it as DS Steel Sdn Bhd").
17. In address part, after postal code, there shall be a space before the state name. (Example: "12345 Selangor").
18. If there is φ symbol in the description, it's the diameter symbol please display "⌀".
19. The PO number all alphabet shall be capital letters. (Example: LXSKJ2025001-10-10-123). The vehicle number all alphabet shall be capital letters. (Example: WXY1234A, ABC1234).
20. Company name list and addresses that may appear in the documents are as per below. Use this if the company name and address if you notice it's highly similar to the below list.:
GBI Mesh & Bar Trading Sdn. Bhd. 8, Lorong Bakap Indah 10, Taman Bakap Indah, 14200 Sungai Bakap, Pulau Pinang. Tel: 014-391 3419
Coltron Construction Sdn. Bhd. LOT 224 KWS Perindustrian Bukit Kayu Hitam, 06050 Bukit Kayu Hitam, Kedah.
EC Excel Wire Sdn. Bhd. Lot 77A & 77B, Lorong Gebeng 1/7, Gebeng Industrial Estate, 26080 Kuantan, Pahang.
Eng Soon Hardware Trading Sdn. Bhd. B-73, Jalan Sri Kemuning, Off Jalan Mentakab, 28000 Temerloh, Pahang.
Hillhome Builder Sdn. Bhd. DEL: Site LOT 2091, Mukim Bentong, Pahang.
21. If you come across company name like:
GBIMESH&BARTRADING SDN.BHD. Please show it as GBI Mesh & Bar Trading Sdn. Bhd.
Coltronconstructionsdn.bhd. Please show it as Coltron Construction Sdn. Bhd.
22. **CRITICAL OCR CHARACTER CORRECTION ALGORITHM**: For D/O numbers, P/O numbers, and all alphanumeric reference codes, you MUST correct ambiguous OCR characters using the date as reference. This is MANDATORY and HIGH PRIORITY.

Rules for character correction (apply these in order):
a) **Date-based correction (HIGHEST PRIORITY)**: If document contains a date, extract the month and year digits. Then scan all ID/reference numbers and replace ambiguous characters with the digits from the date.
   - Example: If date is 25/11/2025 (month=11, year=2025), then in any ID field containing "2S1l", replace S→5 and l→1 to get "2511"
   - Example: If date is 10/12/2024 and you see "PO1012", verify 1 and 0 are correct based on month(12) and year digits
   
b) **Character substitution priority**: When you encounter ambiguous characters in ID numbers, apply these substitutions:
   - S → 5 (especially in first 4-8 characters of codes where date patterns appear)
   - l (lowercase L) → 1
   - I (uppercase i) → 1
   - O (letter O) → 0 (in numeric sections)
   - Z → 2 (in numeric sections)
   - B → 8 (in numeric sections)
   - G → 6 (in numeric sections)
   
c) **Format validation**: After correction, verify the number follows expected format:
   - Alliance Steel P/O format: LXSKJ + 4-digit year-month + remaining digits (e.g., LXSKJ2025001-10-10-123)
   - Standard D/O format: Usually contains 4 consecutive digits representing YYMM or MMDD from the date
   
d) **MUST DO**: Always compare corrected result with the document date. If they don't align, re-examine and correct again.

Example corrections:
- OCR reads: "PO2S1l" + Date is "25/11/2025" → Correct to: "PO2511" (2=2✓, S→5, 1=1✓, l→1)
- OCR reads: "LXSKj202S001" + Date is "11/10/2025" → Correct to: "LXSKJ202S001" → "LXSKJ20251001" (S→5 based on date pattern)
- OCR reads: "DO1012A" + Date is "10/12/2025" → Verify: "10" (month), "12" (day), keep as "DO1012A" ✓

**CRITICAL REMINDER**: This character correction is not optional. You MUST apply it to ALL ID numbers, reference codes, P/O numbers, and D/O numbers in the document. Do NOT output ambiguous characters like 'S' instead of '5' or 'l' instead of '1' in any ID field.
"""
