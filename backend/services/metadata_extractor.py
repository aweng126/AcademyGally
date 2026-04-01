# backend/services/metadata_extractor.py
"""
Metadata extraction service.

1. Renders PDF page 0 to PNG.
2. Sends to configured VLM (via vlm_analyzer) to extract title/authors/year/venue/institution.
3. Queries Semantic Scholar API with the extracted title for cross-verification.
"""
import json
import logging
import os
import urllib.parse
import urllib.request
from pathlib import Path
from urllib.error import HTTPError

import fitz  # PyMuPDF

from services.vlm_analyzer import analyze_image

logger = logging.getLogger(__name__)

FIGURES_DIR = Path(os.getenv("FIGURES_DIR", "./data/figures"))


def extract_metadata(paper_id: str, pdf_path: str) -> dict:
    """
    Returns:
        {
            "vlm_result": {title, authors, year, venue, institution} | None,
            "scholar_suggestion": {title, authors, year, venue, doi} | None,
        }
    """
    vlm_result = _extract_via_vlm(paper_id, pdf_path)
    scholar_suggestion = None
    if vlm_result and vlm_result.get("title"):
        scholar_suggestion = _query_semantic_scholar(vlm_result["title"])
    return {"vlm_result": vlm_result, "scholar_suggestion": scholar_suggestion}


def _extract_via_vlm(paper_id: str, pdf_path: str) -> dict | None:
    """Render PDF page 0 as PNG, send to VLM, return structured metadata dict."""
    page_img_dir = FIGURES_DIR / paper_id
    page_img_dir.mkdir(parents=True, exist_ok=True)
    page_img_path = page_img_dir / "page_0_meta.png"
    rel_path = f"{paper_id}/page_0_meta.png"

    doc = fitz.open(pdf_path)
    try:
        page = doc[0]
        pix = page.get_pixmap(dpi=150)
        pix.save(str(page_img_path))
    finally:
        doc.close()

    try:
        return analyze_image(rel_path, "metadata")
    except Exception as e:
        logger.warning("VLM metadata extraction failed: %s", e, exc_info=True)
        return None


def _query_semantic_scholar(title: str) -> dict | None:
    """Query Semantic Scholar for paper metadata by title. Returns None on any error."""
    try:
        query = urllib.parse.quote(title)
        url = (
            "https://api.semanticscholar.org/graph/v1/paper/search"
            f"?query={query}&fields=title,authors,year,venue,externalIds&limit=1"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "AcademyGally/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())

        papers = data.get("data", [])
        if not papers:
            return None

        p = papers[0]
        return {
            "title": p.get("title"),
            "authors": [a["name"] for a in p.get("authors", [])],
            "year": p.get("year"),
            "venue": p.get("venue"),
            "doi": (p.get("externalIds") or {}).get("DOI"),
        }
    except HTTPError as e:
        if e.code == 429:
            logger.debug("Semantic Scholar rate limited (429), skipping suggestions")
        else:
            logger.warning("Semantic Scholar query failed (HTTP %s): %s", e.code, e)
        return None
    except Exception as e:
        logger.warning("Semantic Scholar query failed: %s", e)
        return None
