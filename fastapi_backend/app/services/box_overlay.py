"""OCR-box visualisation for the review UI.

Composites a page PNG with the OCR text-detection rectangles produced by
Chandra. The output is a side-by-side image: the original page on the
left with quad outlines, and a clean right panel that prints each block's
text next to the position of its source box. Output style mirrors the
diagnostic side-by-side view OCR debuggers tend to produce; the
implementation here is independent — a thin PIL wrapper, no third-party
viz runtime.

Inputs are read straight off the persisted Chandra `chunks` payload so
any saved extraction run can be re-rendered without re-running OCR. The
block-level data Chandra emits (`block_type`, `polygon`, `bbox`, per-block
`html`) is richer than the Docling text projection — tables and pictures
get their own bboxes too — so we read from `chunks_raw` directly.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from io import BytesIO
from typing import Any

from PIL import Image, ImageDraw, ImageFont

_log = logging.getLogger(__name__)

# Block-type → outline colour. Stable mapping so successive renders read
# the same way. Picked to stay legible against grey scans.
_TYPE_COLORS: dict[str, tuple[int, int, int]] = {
    "Text": (52, 132, 197),  # blue
    "SectionHeader": (197, 60, 52),  # red
    "Table": (52, 168, 83),  # green
    "Picture": (170, 100, 30),  # amber-brown
    "Caption": (140, 90, 180),  # purple
    "Footnote": (110, 110, 110),  # grey
    "Formula": (200, 60, 130),  # magenta
    "ListGroup": (40, 140, 160),  # teal
    "PageHeader": (90, 90, 90),
    "PageFooter": (90, 90, 90),
}
_DEFAULT_COLOR = (60, 60, 60)


@dataclass(frozen=True)
class TextBox:
    """One Chandra block reduced to bbox + display text."""

    quad: tuple[
        tuple[float, float],
        tuple[float, float],
        tuple[float, float],
        tuple[float, float],
    ]
    text: str
    block_type: str = "Text"


_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _strip_html(html: str) -> str:
    """Cheap HTML → plain-text for the right-panel labels.

    Chandra block HTML is small and well-formed; we don't need a real
    parser. Drop tags, collapse whitespace, decode the few entities the
    OCR commonly emits.
    """
    if not html:
        return ""
    text = _HTML_TAG_RE.sub(" ", html)
    text = (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
    )
    return _WS_RE.sub(" ", text).strip()


def _polygon_to_quad(
    polygon: list[list[float]] | None,
    bbox: list[float] | None,
) -> (
    tuple[
        tuple[float, float],
        tuple[float, float],
        tuple[float, float],
        tuple[float, float],
    ]
    | None
):
    """Resolve a 4-point quad. Polygons are preferred (rotation-aware)."""
    if polygon and len(polygon) >= 4:
        try:
            pts = [(float(p[0]), float(p[1])) for p in polygon[:4]]
            return (pts[0], pts[1], pts[2], pts[3])
        except (TypeError, ValueError, IndexError):
            pass
    if bbox and len(bbox) == 4:
        try:
            x0, y0, x1, y1 = (float(v) for v in bbox)
            return ((x0, y0), (x1, y0), (x1, y1), (x0, y1))
        except (TypeError, ValueError):
            pass
    return None


def text_boxes_from_chandra(
    chunks: dict[str, Any],
    page_no: int,
) -> list[TextBox]:
    """Walk Chandra `chunks.blocks[]` and pull out every block on `page_no`.

    Chandra uses 0-indexed page numbers internally, while the rest of
    the app speaks 1-indexed (matching DocumentPage.page_no). Convert.
    """
    out: list[TextBox] = []
    blocks = chunks.get("blocks") or []
    target = page_no - 1  # Chandra 0-indexed
    for block in blocks:
        if int(block.get("page", -1)) != target:
            continue
        quad = _polygon_to_quad(block.get("polygon"), block.get("bbox"))
        if quad is None:
            continue
        block_type = str(block.get("block_type") or "Text")
        # Picture blocks have alt-text encoded in their HTML; falling
        # back to that gives the right panel something meaningful for
        # stamps/signatures.
        text = _strip_html(block.get("html") or "") or (block.get("markdown") or "")
        out.append(TextBox(quad=quad, text=text, block_type=block_type))
    return out


def chandra_page_dims(
    chunks: dict[str, Any],
    page_no: int,
) -> tuple[float, float] | None:
    """Resolve `(width, height)` of a page from Chandra `page_info`.

    Format observed in practice:
        page_info = {"0": {"bbox": [0, 0, w, h], "polygon": [...]}}
    """
    info = chunks.get("page_info") or {}
    page = info.get(str(page_no - 1)) or info.get(page_no - 1)
    if not isinstance(page, dict):
        return None
    bbox = page.get("bbox")
    if not bbox or len(bbox) != 4:
        return None
    try:
        x0, y0, x1, y1 = (float(v) for v in bbox)
        return (x1 - x0, y1 - y0)
    except (TypeError, ValueError):
        return None


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Load a CJK-capable font; fall back to PIL default if none available."""
    candidates = [
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_overlay(
    page_png_bytes: bytes,
    boxes: list[TextBox],
    *,
    source_page_size: tuple[float, float] | None = None,
) -> bytes:
    """Composite the page image with detection quads + a text panel.

    `source_page_size` is `(width, height)` in the coordinate system the
    boxes were captured in (Chandra's pre-OCR page render). Used to
    rescale boxes onto the review-UI page render which may use a
    different DPI.
    """
    page = Image.open(BytesIO(page_png_bytes)).convert("RGB")
    img_w, img_h = page.size

    sx, sy = 1.0, 1.0
    if source_page_size is not None:
        sw, sh = source_page_size
        if sw > 0 and sh > 0:
            sx, sy = img_w / sw, img_h / sh

    left_panel = page.copy()
    overlay = Image.new("RGBA", left_panel.size, (255, 255, 255, 0))
    draw_l = ImageDraw.Draw(overlay)

    right_panel = Image.new("RGB", left_panel.size, (255, 255, 255))
    draw_r = ImageDraw.Draw(right_panel)

    for box in boxes:
        scaled = [(x * sx, y * sy) for (x, y) in box.quad]
        color = _TYPE_COLORS.get(box.block_type, _DEFAULT_COLOR)

        # Outline thickness scales with block type — section headers + tables
        # get heavier strokes so they pop against dense text regions.
        width = 3 if box.block_type in ("SectionHeader", "Table", "Picture") else 2
        draw_l.polygon(scaled, outline=(*color, 230), width=width)
        draw_l.polygon(scaled, fill=(*color, 32))

        xs = [p[0] for p in scaled]
        ys = [p[1] for p in scaled]
        bx0, by0, bx1, by1 = min(xs), min(ys), max(xs), max(ys)
        target_h = max(int(by1 - by0) - 4, 11)
        font = _font(min(target_h, 26))

        # Right-panel cell: outlined region + label text. Truncate long
        # paragraph blocks to a single line so the panel stays readable.
        draw_r.rectangle((bx0, by0, bx1, by1), outline=(220, 220, 220), width=1)
        label = box.text or f"[{box.block_type}]"
        if len(label) > 200:
            label = label[:197] + "…"
        draw_r.text((bx0 + 3, by0 + 2), label, fill=color, font=font)

    composited = Image.alpha_composite(left_panel.convert("RGBA"), overlay).convert(
        "RGB"
    )

    out = Image.new("RGB", (img_w * 2, img_h), (255, 255, 255))
    out.paste(composited, (0, 0))
    out.paste(right_panel, (img_w, 0))

    buf = BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
