import os
import re
import fitz  # PyMuPDF
from .module_registry import ExtractedItem

# Ignore rendered crops smaller than this in either dimension (px)
MIN_IMAGE_PX = 80

# Minimum figure height in PDF points (before rendering).
# 50 pts ≈ 1.8 cm, safely above a single line of text.
MIN_FIGURE_HEIGHT_PTS = 50

# Text blocks ending within this many points above a caption are treated as
# part of the figure area (e.g. axis labels, sub-captions), not as prose
# separators.  Text blocks ending MORE than this gap above the caption are
# treated as preceding body text, and the figure starts at their bottom edge.
TEXT_FIGURE_GAP_PTS = 30

# Render resolution — 200 DPI gives noticeably sharper output than 150
_DPI = 200
_MAT = fitz.Matrix(_DPI / 72, _DPI / 72)


def extract_images_from_pdf(pdf_path: str, output_dir: str, paper_id: str) -> list[ExtractedItem]:
    """
    Extract figures from a PDF by rendering pages and cropping the region
    above each 'Figure N' / 'Fig. N' caption.

    Works for both raster-embedded and vector-graphics figures (the common case
    for LaTeX-compiled papers).

    Improvement over the naive "from prev_caption_bottom to next_caption_top"
    approach: we look at all non-caption text blocks above each caption and
    start the crop from the bottom of the last such block (if it ends more than
    TEXT_FIGURE_GAP_PTS above the caption).  This prevents capturing header or
    body text that appears before the first figure on a page.
    """
    os.makedirs(output_dir, exist_ok=True)
    items: list[ExtractedItem] = []

    doc = fitz.open(pdf_path)
    try:
        for page_index in range(len(doc)):
            page = doc[page_index]
            page_num = page_index + 1

            # All text blocks on this page: (x0, y0, x1, y1, text, block_no, block_type)
            blocks = page.get_text("blocks")
            blocks = [b for b in blocks if len(b) >= 5]

            # Separate caption blocks from body-text blocks
            caption_blocks = [
                b for b in blocks
                if re.search(r'(?:Figure|Fig\.?)\s*\d+', b[4], re.IGNORECASE)
            ]
            if not caption_blocks:
                continue

            non_caption_blocks = [b for b in blocks if b not in caption_blocks]

            # Process captions top-to-bottom
            caption_blocks.sort(key=lambda b: b[1])

            prev_y = 0.0
            for cap_block in caption_blocks:
                cx0, cy0, cx1, cy1, cap_text = cap_block[:5]

                # Find the bottom of the last body-text block that:
                #   (a) ends above (cy0 - TEXT_FIGURE_GAP_PTS), and
                #   (b) is below prev_y  (within our search zone)
                # That bottom edge is where the figure region truly starts.
                preceding_body = [
                    b for b in non_caption_blocks
                    if b[3] < cy0 - TEXT_FIGURE_GAP_PTS and b[3] > prev_y
                ]
                if preceding_body:
                    fig_y0 = max(b[3] for b in preceding_body) + 2
                else:
                    fig_y0 = prev_y

                fig_y1 = cy0 - 2  # just above caption text

                # Skip if the figure region is too small
                if fig_y1 - fig_y0 < MIN_FIGURE_HEIGHT_PTS:
                    prev_y = cy1
                    continue

                # Use full page width so two-column figures are not clipped
                clip = fitz.Rect(0, fig_y0, page.rect.width, fig_y1)
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
                prev_y = cy1  # advance past caption for next figure on the same page
    finally:
        doc.close()

    return items
