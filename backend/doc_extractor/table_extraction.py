import csv
from io import StringIO

# Optional pdfplumber import
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False


def extract_tables_from_pdf(filepath: str) -> dict:
    """Extract tables from PDF using pdfplumber. Returns {page_num: [tables]}."""
    tables_data = {}
    if not PDFPLUMBER_AVAILABLE:
        return tables_data

    try:
        with pdfplumber.open(filepath) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                tables = []

                # Strategy 1: Standard extraction
                try:
                    standard_tables = page.extract_tables()
                    if standard_tables:
                        tables.extend(standard_tables)
                except Exception:
                    pass

                # Strategy 2: Line-based extraction with tuned settings
                if not tables:
                    try:
                        settings = {
                            "vertical_strategy": "lines",
                            "horizontal_strategy": "lines",
                            "explicit_vertical_lines": [],
                            "explicit_horizontal_lines": [],
                            "snap_tolerance": 3,
                            "join_tolerance": 3,
                            "edge_min_length": 3,
                            "min_words_vertical": 3,
                            "min_words_horizontal": 1,
                        }
                        tables = page.extract_tables(table_settings=settings)
                    except Exception:
                        pass

                if tables:
                    tables_data[page_num] = tables
    except Exception as e:
        print(f"Warning: Table extraction failed: {e}")

    return tables_data


def clean_cell_content(cell) -> str:
    """Normalize a table cell: handle None, strip whitespace, collapse spaces."""
    if cell is None:
        return ""
    return " ".join(str(cell).strip().split())


def _pad_table(table: list) -> tuple[list, int]:
    """Clean cells, remove empty rows, pad to uniform column count."""
    cleaned = []
    for row in table:
        cleaned_row = [clean_cell_content(c) for c in row]
        if any(cleaned_row):
            cleaned.append(cleaned_row)
    if not cleaned:
        return [], 0
    max_cols = max(len(r) for r in cleaned)
    for row in cleaned:
        row.extend([""] * (max_cols - len(row)))
    return cleaned, max_cols


def reconstruct_table_as_markdown(table: list) -> str:
    """Convert a pdfplumber table to Markdown format for LLM consumption."""
    if not table:
        return ""
    cleaned, max_cols = _pad_table(table)
    if not cleaned:
        return ""

    lines = [
        "| " + " | ".join(cleaned[0]) + " |",
        "| " + " | ".join(["---"] * max_cols) + " |",
    ]
    for row in cleaned[1:]:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def reconstruct_table_as_text(table: list) -> str:
    """Convert table to readable text, preferring Markdown with pipe-delimited fallback."""
    if not table:
        return ""
    try:
        return reconstruct_table_as_markdown(table)
    except Exception:
        pass

    cleaned, _ = _pad_table(table)
    return "\n".join(" | ".join(row) for row in cleaned)


def reconstruct_table_as_csv(table: list) -> str:
    """Convert table to CSV format with proper escaping."""
    if not table:
        return ""
    cleaned, _ = _pad_table(table)
    if not cleaned:
        return ""

    output = StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL, lineterminator='\n')
    writer.writerows(cleaned)
    return output.getvalue().strip()


def analyze_table_structure(table: list) -> dict:
    """Return metadata about a table: dimensions, header detection, type estimate."""
    if not table:
        return {"rows": 0, "cols": 0, "has_header": False, "estimated_type": "unknown"}

    rows = len(table)
    cols = max(len(r) for r in table)

    has_header = False
    if rows > 0:
        first_row_clean = [clean_cell_content(c) for c in table[0]]
        first_text = " ".join(first_row_clean).lower()
        header_keywords = [
            'name', 'description', 'qty', 'quantity', 'price', 'amount',
            'total', 'item', 'no', 'number', 'date', 'details', 'weight',
        ]
        avg_len = sum(len(c) for c in first_row_clean) / max(len(first_row_clean), 1)
        has_header = any(kw in first_text for kw in header_keywords) or (avg_len < 15 and rows > 1)

    if cols <= 3 and rows <= 5:
        estimated_type = "summary_table"
    elif cols > 8:
        estimated_type = "wide_table"
    elif rows > 50:
        estimated_type = "large_table"
    else:
        estimated_type = "data_table"

    return {
        "rows": rows,
        "cols": cols,
        "has_header": has_header,
        "estimated_type": estimated_type,
        "cell_count": rows * cols,
    }
