from .module_registry import ExtractedItem


def extract_images_from_pdf(pdf_path: str, output_dir: str) -> list[ExtractedItem]:
    """
    Use PyMuPDF to extract all images + captions from a PDF.
    Returns a list of ExtractedItem with image_path, page_number, caption.
    """
    # TODO: implement with fitz (PyMuPDF)
    raise NotImplementedError
