import os
import re
import fitz  # PyMuPDF
from .module_registry import ExtractedItem

# Ignore images smaller than this in either dimension (px) — logos, icons, decorative elements
MIN_IMAGE_PX = 120


def extract_images_from_pdf(pdf_path: str, output_dir: str, paper_id: str) -> list[ExtractedItem]:
    """
    Extract all non-trivial images from a PDF using PyMuPDF.
    Saves images to output_dir and returns ExtractedItem list with relative paths.
    """
    os.makedirs(output_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    items: list[ExtractedItem] = []

    for page_index in range(len(doc)):
        page = doc[page_index]
        page_num = page_index + 1
        page_text = page.get_text()
        captions = _extract_captions(page_text)
        image_list = page.get_images(full=True)

        fig_idx = 0
        for img_meta in image_list:
            xref = img_meta[0]
            base_image = doc.extract_image(xref)

            w, h = base_image.get("width", 0), base_image.get("height", 0)
            if w < MIN_IMAGE_PX or h < MIN_IMAGE_PX:
                continue

            ext = base_image.get("ext", "png")
            if ext not in ("png", "jpeg", "jpg", "bmp"):
                ext = "png"

            filename = f"p{page_num}_{fig_idx}.{ext}"
            abs_path = os.path.join(output_dir, filename)
            with open(abs_path, "wb") as f:
                f.write(base_image["image"])

            caption = captions[fig_idx] if fig_idx < len(captions) else None

            items.append(
                ExtractedItem(
                    image_path=f"{paper_id}/{filename}",
                    page_number=page_num,
                    caption=caption,
                )
            )
            fig_idx += 1

    doc.close()
    return items


def _extract_captions(text: str) -> list[str]:
    """
    Extract all 'Figure N' captions from a page's text.
    Returns list ordered by appearance.
    """
    pattern = r"(?:Figure|Fig\.?)\s*\d+[.:]?\s*(.+?)(?=(?:Figure|Fig\.?)\s*\d+|\Z)"
    matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)
    return [" ".join(m.split())[:500] for m in matches]
