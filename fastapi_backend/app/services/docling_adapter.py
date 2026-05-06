"""Chandra `chunks` → DoclingDocument adapter.

Chandra (`client.convert(mode="accurate", output_format="chunks")`) returns
block-level structure with bbox/polygon/HTML. We map that into Docling's
canonical `DoclingDocument` IR so downstream consumers (DB persistence,
bbox-mapper UI, future LLM passes) speak one schema.

Block-type mapping
------------------

  Chandra            →  Docling DocItemLabel
  ----------------      -------------------------
  Text                  TEXT (paragraph-like)
  SectionHeader         SECTION_HEADER (via add_heading)
  Table                 TABLE (HTML parsed into TableData)
  Picture               PICTURE
  Form                  FORM (HTML preserved in fallback text)
  ListGroup             LIST + LIST_ITEMs (HTML <li> parsed)
  *                     TEXT (permissive fallback)

Coordinate space
----------------

Chandra bbox/polygon are in PDF user-space points (origin top-left,
y-axis down). Docling uses `CoordOrigin.TOPLEFT` with the same units, so
the values pass through unchanged.

Page sizes
----------

Chandra's `chunks.page_info` carries per-page width/height. If absent we
fall back to a US-letter default and emit a warning. Not fatal — bbox
coords still align with whatever the original PDF used.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any

from docling_core.types.doc import BoundingBox, CoordOrigin, DocItemLabel
from docling_core.types.doc.document import (
    DoclingDocument,
    PageItem,
    ProvenanceItem,
    Size,
    TableCell,
    TableData,
)

_log = logging.getLogger(__name__)

_DEFAULT_PAGE_SIZE = Size(width=612.0, height=792.0)  # US letter, fallback only

_BLOCK_TYPE_TO_LABEL: dict[str, DocItemLabel] = {
    "Text": DocItemLabel.TEXT,
    "SectionHeader": DocItemLabel.SECTION_HEADER,
    "Table": DocItemLabel.TABLE,
    "Picture": DocItemLabel.PICTURE,
    "Form": DocItemLabel.FORM,
    "Caption": DocItemLabel.CAPTION,
    "Footnote": DocItemLabel.FOOTNOTE,
    "PageHeader": DocItemLabel.PAGE_HEADER,
    "PageFooter": DocItemLabel.PAGE_FOOTER,
    "ListItem": DocItemLabel.LIST_ITEM,
    "Code": DocItemLabel.CODE,
    "Formula": DocItemLabel.FORMULA,
    "Title": DocItemLabel.TITLE,
}


# --- HTML utilities ----------------------------------------------------------


def _strip_html(html: str | None) -> str:
    """Strip HTML tags + decode common entities. Used for text blocks."""
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
    )
    return re.sub(r"\s+", " ", text).strip()


@dataclass
class _Cell:
    row: int
    col: int
    text: str
    is_header: bool = False
    rowspan: int = 1
    colspan: int = 1


class _TableHtmlParser(HTMLParser):
    """Minimal HTML <table> parser → grid of cells.

    Handles colspan/rowspan, <thead>/<tbody>/<tr>/<th>/<td>. Ignores
    nested formatting tags (b/i/br) — their text content is captured.
    """

    def __init__(self) -> None:
        super().__init__()
        self._cells: list[_Cell] = []
        self._current_row: int = -1
        self._current_text: list[str] = []
        self._in_cell: bool = False
        self._cell_is_header: bool = False
        self._cell_rowspan: int = 1
        self._cell_colspan: int = 1
        self._next_col_for_row: dict[int, int] = {}
        self._occupied: set[tuple[int, int]] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {k: v for k, v in attrs}
        if tag == "tr":
            self._current_row += 1
        elif tag in ("td", "th"):
            self._in_cell = True
            self._cell_is_header = tag == "th"
            self._cell_rowspan = int(attr_map.get("rowspan", "1") or "1")
            self._cell_colspan = int(attr_map.get("colspan", "1") or "1")
            self._current_text = []
        elif tag == "br" and self._in_cell:
            self._current_text.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("td", "th") and self._in_cell:
            text = "".join(self._current_text).strip()
            row = self._current_row
            # Find the next free column on this row
            col = self._next_col_for_row.get(row, 0)
            while (row, col) in self._occupied:
                col += 1
            self._cells.append(
                _Cell(
                    row=row,
                    col=col,
                    text=text,
                    is_header=self._cell_is_header,
                    rowspan=self._cell_rowspan,
                    colspan=self._cell_colspan,
                )
            )
            for r in range(row, row + self._cell_rowspan):
                for c in range(col, col + self._cell_colspan):
                    self._occupied.add((r, c))
            self._next_col_for_row[row] = col + self._cell_colspan
            self._in_cell = False

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._current_text.append(data)

    @property
    def cells(self) -> list[_Cell]:
        return self._cells


def _parse_table_html(html: str | None) -> TableData:
    """Parse a <table> HTML fragment into Docling TableData."""
    if not html:
        return TableData(num_rows=0, num_cols=0, table_cells=[])

    parser = _TableHtmlParser()
    try:
        parser.feed(html)
    except Exception as exc:  # noqa: BLE001
        _log.warning("Table HTML parse failed (%s); returning placeholder", exc)
        return TableData(
            num_rows=1,
            num_cols=1,
            table_cells=[
                TableCell(
                    text=_strip_html(html),
                    start_row_offset_idx=0,
                    end_row_offset_idx=1,
                    start_col_offset_idx=0,
                    end_col_offset_idx=1,
                )
            ],
        )

    cells = parser.cells
    if not cells:
        return TableData(num_rows=0, num_cols=0, table_cells=[])

    num_rows = max(c.row for c in cells) + 1
    num_cols = max(c.col + c.colspan for c in cells)
    table_cells: list[TableCell] = [
        TableCell(
            text=c.text,
            start_row_offset_idx=c.row,
            end_row_offset_idx=c.row + c.rowspan,
            start_col_offset_idx=c.col,
            end_col_offset_idx=c.col + c.colspan,
            column_header=c.is_header and c.row == 0,
            row_header=c.is_header and c.row > 0,
        )
        for c in cells
    ]
    return TableData(num_rows=num_rows, num_cols=num_cols, table_cells=table_cells)


# Match list items inside a <ListGroup> block's html (<li>...</li>)
_LIST_ITEM_RE = re.compile(r"<li[^>]*>(.*?)</li>", re.DOTALL | re.IGNORECASE)


def _parse_list_items(html: str | None) -> list[str]:
    if not html:
        return []
    items = _LIST_ITEM_RE.findall(html)
    return [_strip_html(item) for item in items]


# --- bbox conversion --------------------------------------------------------


def _bbox_from_chunk(chunk: dict[str, Any]) -> BoundingBox | None:
    """Extract a `BoundingBox` from a chunk's `bbox` (or `polygon` fallback)."""
    bbox = chunk.get("bbox")
    if bbox and len(bbox) == 4:
        left, top, right, bottom = bbox
        return BoundingBox(
            l=float(left),
            t=float(top),
            r=float(right),
            b=float(bottom),
            coord_origin=CoordOrigin.TOPLEFT,
        )
    polygon = chunk.get("polygon")
    if polygon:
        xs = [pt[0] for pt in polygon]
        ys = [pt[1] for pt in polygon]
        return BoundingBox(
            l=float(min(xs)),
            t=float(min(ys)),
            r=float(max(xs)),
            b=float(max(ys)),
            coord_origin=CoordOrigin.TOPLEFT,
        )
    return None


def _make_prov(chunk: dict[str, Any], char_count: int) -> ProvenanceItem | None:
    bbox = _bbox_from_chunk(chunk)
    if bbox is None:
        return None
    page_no = int(chunk.get("page", 0)) + 1  # Chandra 0-indexed → Docling 1-indexed
    return ProvenanceItem(
        page_no=page_no,
        bbox=bbox,
        charspan=(0, max(0, char_count)),
    )


# --- main entrypoint --------------------------------------------------------


def _resolve_page_sizes(
    chunks_payload: dict[str, Any], page_count: int
) -> dict[int, Size]:
    """Build {page_no_1indexed: Size} from chunks.page_info if present."""
    page_info = (
        chunks_payload.get("page_info") if isinstance(chunks_payload, dict) else None
    )
    sizes: dict[int, Size] = {}
    if isinstance(page_info, dict):
        for key, info in page_info.items():
            try:
                page_no_zero = int(key)
            except (ValueError, TypeError):
                continue
            if not isinstance(info, dict):
                continue
            width = info.get("width") or info.get("page_width")
            height = info.get("height") or info.get("page_height")
            if width and height:
                sizes[page_no_zero + 1] = Size(width=float(width), height=float(height))
    elif isinstance(page_info, list):
        for entry in page_info:
            if not isinstance(entry, dict):
                continue
            page_no_zero = entry.get("page", entry.get("index"))
            width = entry.get("width") or entry.get("page_width")
            height = entry.get("height") or entry.get("page_height")
            if page_no_zero is not None and width and height:
                sizes[int(page_no_zero) + 1] = Size(
                    width=float(width), height=float(height)
                )

    # Fill missing pages with default
    for page_no in range(1, page_count + 1):
        sizes.setdefault(page_no, _DEFAULT_PAGE_SIZE)
    return sizes


def chunks_to_docling_document(
    chunks_payload: dict[str, Any] | None,
    *,
    name: str = "document",
    page_count: int | None = None,
) -> DoclingDocument:
    """Build a `DoclingDocument` from a Chandra `chunks` response.

    Args:
        chunks_payload: The `.chunks` field of a `ConversionResult`
            (a dict with 'blocks', 'page_info', 'metadata').
        name: Working name for the document.
        page_count: Falls back to `chunks_payload['metadata']['page_count']`
            if not provided; otherwise inferred from the highest `page` index
            seen in blocks.

    Returns:
        A populated `DoclingDocument` with text/section/table/picture
        items, each with `prov` carrying page_no + bbox.
    """
    payload = chunks_payload or {}
    blocks = payload.get("blocks", []) if isinstance(payload, dict) else []
    metadata = payload.get("metadata") if isinstance(payload, dict) else None

    if page_count is None:
        if isinstance(metadata, dict):
            page_count = metadata.get("page_count")
        if page_count is None and blocks:
            page_count = max(int(b.get("page", 0)) for b in blocks) + 1
    page_count = max(int(page_count or 1), 1)

    doc = DoclingDocument(name=name)
    page_sizes = _resolve_page_sizes(payload, page_count)
    for page_no, size in page_sizes.items():
        doc.pages[page_no] = PageItem(page_no=page_no, size=size)

    list_group_node = None  # currently open list group (if any)

    for chunk in blocks:
        block_type = chunk.get("block_type") or "Text"
        html = chunk.get("html") or ""
        markdown = chunk.get("markdown")
        text = (
            _strip_html(html) if not markdown else markdown.strip() or _strip_html(html)
        )
        prov = _make_prov(chunk, len(text))

        try:
            if block_type == "SectionHeader":
                level = _section_level(chunk.get("section_hierarchy"))
                doc.add_heading(text=text, level=level, prov=prov)
                list_group_node = None

            elif block_type == "Table":
                table_data = _parse_table_html(html)
                doc.add_table(data=table_data, prov=prov)
                list_group_node = None

            elif block_type == "Picture":
                doc.add_picture(prov=prov)
                list_group_node = None

            elif block_type == "ListGroup":
                list_group_node = doc.add_list_group()
                items = _parse_list_items(html)
                for item_text in items:
                    item_prov = ProvenanceItem(
                        page_no=prov.page_no if prov else 1,
                        bbox=prov.bbox
                        if prov
                        else BoundingBox(
                            l=0, t=0, r=0, b=0, coord_origin=CoordOrigin.TOPLEFT
                        ),
                        charspan=(0, len(item_text)),
                    )
                    doc.add_list_item(
                        text=item_text,
                        parent=list_group_node,
                        prov=item_prov,
                    )

            else:
                # Text, Form, and any unknown block_type → paragraph
                label = _BLOCK_TYPE_TO_LABEL.get(block_type, DocItemLabel.TEXT)
                doc.add_text(label=label, text=text, prov=prov)
                list_group_node = None
        except Exception as exc:  # noqa: BLE001
            _log.warning(
                "Failed to add chunk id=%r block_type=%r: %s",
                chunk.get("id"),
                block_type,
                exc,
            )

    return doc


def _section_level(section_hierarchy: Any) -> int:
    """Pick a heading level from Chandra's section_hierarchy dict.

    Chandra encodes it as `{"1": "/page/.../SectionHeader/x", "2": ...}`;
    the highest numeric key tells us how deep this header nests.
    """
    if not isinstance(section_hierarchy, dict) or not section_hierarchy:
        return 1
    try:
        return min(max(int(k) for k in section_hierarchy.keys()), 6)
    except (ValueError, TypeError):
        return 1
