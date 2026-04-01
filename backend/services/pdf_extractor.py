import os
import re
import fitz  # PyMuPDF
from .module_registry import ExtractedItem

# Ignore rendered crops smaller than this in either dimension (px)
MIN_IMAGE_PX = 100

# Render resolution
_DPI = 150
_MAT = fitz.Matrix(_DPI / 72, _DPI / 72)


def extract_images_from_pdf(pdf_path: str, output_dir: str, paper_id: str) -> list[ExtractedItem]:
    """
    Extract figures from a PDF by rendering pages and cropping the region
    above each 'Figure N' / 'Fig. N' caption.

    Works for both raster-embedded and vector-graphics figures (the common case
    for LaTeX-compiled papers).  For each caption found the area between the
    previous caption's bottom edge (or the page top) and the current caption's
    top edge is rendered as a PNG.
    """
    os.makedirs(output_dir, exist_ok=True)
    items: list[ExtractedItem] = []

    doc = fitz.open(pdf_path)
    try:
        for page_index in range(len(doc)):
            page = doc[page_index]
            page_num = page_index + 1

            # Collect text blocks that contain a "Figure N" caption
            blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no, block_type)
            caption_blocks = [
                b for b in blocks
                if len(b) >= 5 and re.search(r'(?:Figure|Fig\.?)\s*\d+', b[4], re.IGNORECASE)
            ]
            if not caption_blocks:
                continue

            # Process captions top-to-bottom
            caption_blocks.sort(key=lambda b: b[1])

            prev_y = 0.0
            for cap_block in caption_blocks:
                cx0, cy0, cx1, cy1, cap_text = cap_block[:5]

                fig_y0 = prev_y
                fig_y1 = cy0 - 2  # just above caption text

                # Skip if the available region is too small to be a real figure
                if fig_y1 - fig_y0 < MIN_IMAGE_PX:
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
