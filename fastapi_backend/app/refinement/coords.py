"""Coordinate conversions for VLM-emitted bboxes.

Gemma 4 emits bounding boxes natively as `box_2d: [x_min, y_min, x_max,
y_max]` normalized to a 1000×1000 image space, regardless of the
actual page dimensions. This module converts between that normalized
space and the PDF point space (BOTTOMLEFT origin in Docling, TOPLEFT
in our `BBox` Pydantic model) the rest of the pipeline uses.

References
----------
- HuggingFace blog "Welcome Gemma 4": coordinates "refer to an image
  size of 1000x1000, relative to the input dimensions".
- Datature blog: same convention as PaliGemma, no grammar-constrained
  generation needed for JSON output.
"""

from __future__ import annotations

from typing import Final

from app.refinement.schemas import BBox

# Gemma 4 normalised image space — same convention as PaliGemma.
GEMMA_NORM_W: Final[int] = 1000
GEMMA_NORM_H: Final[int] = 1000


def gemma_box_to_bbox(
    box_2d: list[int] | tuple[int, int, int, int],
    *,
    page_w: float,
    page_h: float,
) -> BBox:
    """Convert Gemma 4's `[x_min, y_min, x_max, y_max]` (1000-normed,
    TOPLEFT origin) into our PDF-point-space `BBox` (TOPLEFT origin).

    `page_w` / `page_h` are in PDF points (e.g. A4 ≈ 595.44 × 842.04).
    Gemma's image is the rendered page so x scales with page_w and
    y scales with page_h.
    """
    if len(box_2d) != 4:
        raise ValueError(f"box_2d must be 4 ints, got {box_2d!r}")
    x_min, y_min, x_max, y_max = box_2d
    if x_max < x_min or y_max < y_min:
        raise ValueError(f"box_2d not in (x_min,y_min,x_max,y_max) order: {box_2d!r}")

    sx = page_w / GEMMA_NORM_W
    sy = page_h / GEMMA_NORM_H
    return BBox(
        l=x_min * sx,
        t=y_min * sy,
        r=x_max * sx,
        b=y_max * sy,
    )


def bbox_to_gemma_box(bbox: BBox, *, page_w: float, page_h: float) -> list[int]:
    """Inverse of `gemma_box_to_bbox`. Used in eval harness when we
    need to compare an annotator's PDF-point bbox against a model's
    normalized output."""
    sx = GEMMA_NORM_W / page_w
    sy = GEMMA_NORM_H / page_h
    return [
        round(bbox.l * sx),
        round(bbox.t * sy),
        round(bbox.r * sx),
        round(bbox.b * sy),
    ]
