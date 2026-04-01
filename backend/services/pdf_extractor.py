import os
import re
import fitz  # PyMuPDF
from .module_registry import ExtractedItem

# Render resolution
_DPI = 200
_MAT = fitz.Matrix(_DPI / 72, _DPI / 72)

MIN_IMAGE_PX = 80           # px — ignore renders smaller than this
MIN_FIGURE_HEIGHT_PTS = 40  # PDF points — skip regions shallower than this

# A vertical gap larger than this (in PDF points) between consecutive same-column
# text blocks is treated as "figure space".  20 pt ≈ 7 mm, safely above a normal
# inter-paragraph gap (~12 pt) yet below any reasonable figure height.
SIGNIFICANT_GAP_PTS = 20

# Horizontal margin added when clipping a single column so we don't accidentally
# cut off wide axis labels or multi-column spanning elements.
COL_MARGIN_PTS = 15


def _classify_column(cx0: float, cx1: float, page_width: float) -> str:
    """Return 'left', 'right', or 'full' based on the caption's horizontal span."""
    if (cx1 - cx0) / page_width > 0.55:
        return "full"
    return "left" if (cx0 + cx1) / 2 < page_width / 2 else "right"


def extract_images_from_pdf(pdf_path: str, output_dir: str, paper_id: str) -> list[ExtractedItem]:
    """
    Extract figures from a PDF by rendering the region above each 'Figure N'
    caption.  Works for both raster-embedded and vector-graphics figures.

    Key improvements over naive "slice from prev caption to next caption":

    1. Column-aware filtering — for two-column papers the caption's column is
       detected and only text blocks in the SAME column are used to find figure
       boundaries.  This eliminates cross-column contamination (the main cause
       of tiny/empty crops in the previous implementation).

    2. Upward gap walk — starting at the caption top we walk upward block by
       block; the first vertical gap >= SIGNIFICANT_GAP_PTS is the figure area.
       This correctly handles text ("as shown in Fig 1") immediately above the
       figure, and avoids relying on a global max() that could pick a block from
       the wrong column.

    3. Text-only blocks — block_type=1 (embedded raster images) are excluded so
       they don't corrupt the gap detection.

    4. Column-scoped x-clip — single-column figures are cropped to roughly their
       own column's width, keeping the output tight and reducing whitespace.
    """
    os.makedirs(output_dir, exist_ok=True)
    items: list[ExtractedItem] = []

    doc = fitz.open(pdf_path)
    try:
        for page_index in range(len(doc)):
            page = doc[page_index]
            page_num = page_index + 1
            page_w = page.rect.width

            # Only text blocks (block_type == 0); image blocks have type 1.
            all_blocks = page.get_text("blocks")
            text_blocks = [
                b for b in all_blocks
                if len(b) >= 7 and b[6] == 0 and isinstance(b[4], str)
            ]

            # Find caption blocks — "Figure N" / "Fig. N" / "Fig N" patterns
            caption_blocks = [
                b for b in text_blocks
                if re.search(r'(?:Figure|Fig\.?)\s*\d+(?:\.\d+)?', b[4], re.IGNORECASE)
            ]
            if not caption_blocks:
                continue

            caption_set = set(map(id, caption_blocks))
            non_caption = [b for b in text_blocks if id(b) not in caption_set]

            caption_blocks.sort(key=lambda b: b[1])  # top-to-bottom order

            prev_y = 0.0

            for cap_block in caption_blocks:
                cx0, cy0, cx1, cy1, cap_text = cap_block[:5]

                col = _classify_column(cx0, cx1, page_w)
                page_mid = page_w / 2

                # ── Filter non-caption blocks to same column + our vertical zone ──
                if col == "full":
                    zone_blocks = [
                        b for b in non_caption
                        if prev_y <= b[3] <= cy0
                    ]
                elif col == "left":
                    zone_blocks = [
                        b for b in non_caption
                        if prev_y <= b[3] <= cy0 and (b[0] + b[2]) / 2 < page_mid
                    ]
                else:  # right
                    zone_blocks = [
                        b for b in non_caption
                        if prev_y <= b[3] <= cy0 and (b[0] + b[2]) / 2 >= page_mid
                    ]

                # Sort by bottom edge descending — closest to caption first
                zone_blocks.sort(key=lambda b: b[3], reverse=True)

                # ── Upward gap walk ──
                # Start just above the caption and move upward block by block.
                # The first gap >= SIGNIFICANT_GAP_PTS is the figure region.
                current_pos = cy0
                fig_y0 = prev_y    # fallback: top of the whole zone
                fig_y1 = cy0 - 2  # fallback: just above caption

                for block in zone_blocks:
                    gap = current_pos - block[3]   # space between block bottom and our cursor
                    if gap >= SIGNIFICANT_GAP_PTS:
                        # Found figure space: it runs from block bottom to current_pos
                        fig_y0 = block[3]
                        fig_y1 = current_pos - 2
                        break
                    # No significant gap yet — step above this block and continue
                    current_pos = block[1]
                # If loop exhausted without finding a gap, fig_y0/fig_y1 stay at
                # fallback values (entire zone = all whitespace, likely a big figure).

                if fig_y1 - fig_y0 < MIN_FIGURE_HEIGHT_PTS:
                    prev_y = cy1
                    continue

                # ── Horizontal clip — restrict to relevant column ──
                if col == "left":
                    clip_x0, clip_x1 = 0.0, page_mid + COL_MARGIN_PTS
                elif col == "right":
                    clip_x0, clip_x1 = max(0.0, page_mid - COL_MARGIN_PTS), page_w
                else:
                    clip_x0, clip_x1 = 0.0, page_w

                clip = fitz.Rect(clip_x0, fig_y0, clip_x1, fig_y1)
                pix = page.get_pixmap(matrix=_MAT, clip=clip)

                if pix.width < MIN_IMAGE_PX or pix.height < MIN_IMAGE_PX:
                    prev_y = cy1
                    continue

                filename = f"p{page_num}_{len(items)}.png"
                pix.save(os.path.join(output_dir, filename))

                items.append(ExtractedItem(
                    image_path=f"{paper_id}/{filename}",
                    page_number=page_num,
                    caption=" ".join(cap_text.split())[:500],
                ))
                prev_y = cy1

    finally:
        doc.close()

    return items
