"""
Download a paper PDF from an arXiv URL.

Supports:
  https://arxiv.org/abs/2310.12345
  https://arxiv.org/abs/2310.12345v2
  https://arxiv.org/pdf/2310.12345
  https://arxiv.org/pdf/2310.12345.pdf
"""
import re
import os
import httpx

_ARXIV_ID_RE = re.compile(
    r'arxiv\.org/(?:abs|pdf)/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)',
    re.IGNORECASE,
)


def extract_arxiv_id(url: str) -> str:
    """Extract the arXiv paper ID from a URL. Raises ValueError if not found."""
    m = _ARXIV_ID_RE.search(url)
    if not m:
        raise ValueError(f"Could not extract arXiv ID from URL: {url!r}")
    return m.group(1)


def download_arxiv_pdf(arxiv_id: str, dest_path: str) -> None:
    """
    Download the PDF for the given arXiv ID to dest_path.
    Raises httpx.HTTPStatusError on non-2xx responses.
    """
    pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with httpx.stream("GET", pdf_url, follow_redirects=True, timeout=60) as r:
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_bytes(chunk_size=8192):
                f.write(chunk)
