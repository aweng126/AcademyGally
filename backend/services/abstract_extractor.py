"""
Abstract extractor: locates the Abstract section in a PDF using text heuristics
and creates a ContentItem with the raw text stored in the caption field.
Unlike image modules, abstract does NOT require human confirmation — it is
auto-detected and auto-analyzed during the initial processing pipeline.
"""
import re
import fitz  # PyMuPDF
from .module_registry import BaseExtractor, ExtractedItem

# Patterns ordered from most to least specific
_ABSTRACT_PATTERNS = [
    # "Abstract" header on its own line, content until next numbered section or keyword block
    r"(?:^|\n)[ \t]*(?:Abstract|ABSTRACT)[ \t]*\r?\n(.*?)(?=\r?\n[ \t]*(?:\d+[\.\s]+[A-Z]|\bIntroduction\b|\bKeywords?\b|\bIndex Terms?\b|\bCategories\b))",
    # "Abstract—" or "Abstract:" inline
    r"(?:^|\n)[ \t]*(?:Abstract|ABSTRACT)[—–:\-]\s*(.*?)(?=\r?\n[ \t]*(?:\d+[\.\s]+[A-Z]|\bIntroduction\b|\bKeywords?\b|\bIndex Terms?\b))",
]

_MIN_ABSTRACT_LEN = 100   # Characters — skip noise matches
_MAX_ABSTRACT_LEN = 4000  # Store at most this many chars in caption


def extract_abstract_text(pdf_path: str) -> str | None:
    """
    Scan the first 6 pages of a PDF and return the abstract text, or None.
    The returned string is clean (whitespace normalised) and capped at 4 000 chars.
    """
    doc = fitz.open(pdf_path)
    pages_to_check = min(6, len(doc))
    text = "".join(doc[i].get_text() for i in range(pages_to_check))
    doc.close()

    for pattern in _ABSTRACT_PATTERNS:
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            raw = match.group(1)
            # Normalise whitespace (collapse newlines inside paragraphs)
            cleaned = " ".join(raw.split())
            if len(cleaned) >= _MIN_ABSTRACT_LEN:
                return cleaned[:_MAX_ABSTRACT_LEN]

    return None


class AbstractExtractor(BaseExtractor):
    module_type = "abstract"

    def extract(self, pdf_path: str) -> list[ExtractedItem]:
        text = extract_abstract_text(pdf_path)
        if not text:
            return []
        # Store raw text in raw_data; caption left None (will be set by the router)
        return [ExtractedItem(image_path=None, page_number=1, caption=None, raw_data=text)]

    def analyze(self, item: ExtractedItem) -> dict:
        from .vlm_analyzer import analyze_text
        text = item.raw_data or (item.caption or "")
        return analyze_text(text, self.module_type)
