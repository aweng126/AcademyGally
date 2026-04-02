import logging
import os
import uuid
import json
from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

logger = logging.getLogger(__name__)

from database import get_db, SessionLocal
from models.paper import Paper
from models.content_item import ContentItem
from services.metadata_extractor import extract_metadata
from schemas import (
    PaperOut, ConfirmItemsRequest,
    PaperMetadataResponse, VlmMetadataResult, ScholarSuggestion, MetadataConfirm,
)
from services.pdf_extractor import extract_images_from_pdf
from services.vlm_analyzer import analyze_image

router = APIRouter()

PDFS_DIR = os.getenv("PDFS_DIR", "./data/pdfs")
FIGURES_DIR = os.getenv("FIGURES_DIR", "./data/figures")


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------

def _item_out(item: ContentItem) -> dict:
    d = {c.name: getattr(item, c.name) for c in item.__table__.columns}
    d.pop("embedding_vector", None)
    if d.get("analysis_json"):
        try:
            d["analysis_json"] = json.loads(d["analysis_json"])
        except Exception:
            d["analysis_json"] = None
    # ensure datetime is serialisable
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()
    return d


def _paper_out(paper: Paper, items: list[ContentItem]) -> dict:
    d = {c.name: getattr(paper, c.name) for c in paper.__table__.columns}
    if d.get("uploaded_at"):
        d["uploaded_at"] = d["uploaded_at"].isoformat()
    d["content_items"] = [_item_out(i) for i in items]
    return d


# ---------------------------------------------------------------------------
# Background tasks
# ---------------------------------------------------------------------------

def _extract_metadata_bg(paper_id: str, pdf_path: str) -> None:
    """Background task: extract metadata via VLM + Scholar, store in paper record."""
    db = SessionLocal()
    try:
        paper = db.get(Paper, paper_id)
        if not paper:
            return
        result = extract_metadata(paper_id, pdf_path)
        paper.raw_extracted_metadata = json.dumps(result.get("vlm_result") or {})
        paper.scholar_metadata = json.dumps(result.get("scholar_suggestion") or {})
        db.commit()
    except Exception as e:
        logger.warning("Metadata extraction BG task failed for %s: %s", paper_id, e, exc_info=True)
        db2 = SessionLocal()
        try:
            paper2 = db2.get(Paper, paper_id)
            if paper2:
                paper2.raw_extracted_metadata = json.dumps({})
                db2.commit()
        finally:
            db2.close()
    finally:
        db.close()


def _process_paper_bg(paper_id: str, pdf_path: str) -> None:
    """
    Background pipeline:
    1. Extract all images → create ContentItems (module_type='other', awaiting human confirm)
    2. Auto-detect abstract text → create ContentItem (module_type='abstract') and
       immediately trigger VLM analysis (no human confirmation required for text modules)
    """
    db = SessionLocal()
    try:
        paper = db.query(Paper).filter(Paper.id == paper_id).first()
        if not paper:
            return
        paper.processing_status = "processing"
        db.commit()

        # --- Step 1: extract images ---
        output_dir = os.path.join(FIGURES_DIR, paper_id)
        extracted = extract_images_from_pdf(pdf_path, output_dir, paper_id)
        for item in extracted:
            ci = ContentItem(
                id=str(uuid.uuid4()),
                paper_id=paper_id,
                module_type="other",
                image_path=item.image_path,
                page_number=item.page_number,
                caption=item.caption,
                processing_status="pending",
            )
            db.add(ci)

        # --- Step 2: auto-extract abstract ---
        abstract_item_id: str | None = None
        try:
            from services.abstract_extractor import extract_abstract_text
            abstract_text = extract_abstract_text(pdf_path)
            if abstract_text:
                abstract_id = str(uuid.uuid4())
                abstract_ci = ContentItem(
                    id=abstract_id,
                    paper_id=paper_id,
                    module_type="abstract",
                    image_path=None,
                    page_number=1,
                    # caption stores the raw extracted text (useful for display & analysis)
                    caption=abstract_text,
                    processing_status="pending",
                )
                db.add(abstract_ci)
                abstract_item_id = abstract_id
        except Exception as e:
            logger.warning("Abstract extraction failed for paper %s: %s", paper_id, e, exc_info=True)
            # Non-fatal — continue without abstract

        paper.processing_status = "done"
        db.commit()
    except Exception as e:
        logger.error("Paper processing failed for %s: %s", paper_id, e, exc_info=True)
        db.rollback()
        paper = db.query(Paper).filter(Paper.id == paper_id).first()
        if paper:
            paper.processing_status = "failed"
            db.commit()
        return
    finally:
        db.close()

    # Trigger abstract VLM analysis after paper is marked done.
    # FullAnalysisPage polls for processing content_items so the UI stays consistent.
    if abstract_item_id:
        _analyze_item_bg(abstract_item_id)


def _analyze_item_bg(item_id: str) -> None:
    """
    Run VLM analysis on a confirmed ContentItem and store result.
    - Image modules (arch_figure, eval_figure): call analyze_image()
    - Text modules (abstract): read text from caption, call analyze_text()
    """
    db = SessionLocal()
    try:
        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not item or item.module_type == "other":
            return

        item.processing_status = "processing"
        db.commit()

        if item.module_type == "abstract":
            if not item.caption:
                item.processing_status = "failed"
                db.commit()
                return
            from services.vlm_analyzer import analyze_text
            result = analyze_text(item.caption, item.module_type)
        else:
            result = analyze_image(item.image_path, item.module_type)

        item.analysis_json = json.dumps(result)

        try:
            from services.embedder import embed_analysis
            item.embedding_vector = embed_analysis(result)
        except Exception as e:
            logger.warning("Embedding failed for item %s: %s", item_id, e, exc_info=True)

        item.processing_status = "done"
        db.commit()
    except Exception as e:
        logger.error("VLM analysis failed for item %s: %s", item_id, e, exc_info=True)
        db.rollback()
        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if item:
            item.processing_status = "failed"
            db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=PaperOut)
async def upload_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(default=""),
    venue: str = Form(default=""),
    year: int = Form(default=None),
    authors: str = Form(default=""),
    db: Session = Depends(get_db),
):
    pdfs_dir = os.getenv("PDFS_DIR", "./data/pdfs")
    os.makedirs(pdfs_dir, exist_ok=True)
    paper_id = str(uuid.uuid4())
    pdf_filename = f"{paper_id}.pdf"
    pdf_path = os.path.join(pdfs_dir, pdf_filename)

    with open(pdf_path, "wb") as f:
        content = await file.read()
        f.write(content)

    paper = Paper(
        id=paper_id,
        title=title or "",
        venue=venue or None,
        year=year,
        authors=authors or None,
        pdf_path=pdf_path,
        processing_status="awaiting_metadata",
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    background_tasks.add_task(_extract_metadata_bg, paper.id, pdf_path)
    return paper


from pydantic import BaseModel as _BaseModel


class ArxivImportRequest(_BaseModel):
    url: str


@router.post("/arxiv", response_model=PaperOut)
async def import_arxiv(
    background_tasks: BackgroundTasks,
    body: ArxivImportRequest,
    db: Session = Depends(get_db),
):
    """
    Import a paper from an arXiv URL.
    Body: { "url": "https://arxiv.org/abs/2310.12345" }
    """
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    try:
        from services.arxiv_fetcher import extract_arxiv_id, download_arxiv_pdf
        arxiv_id = extract_arxiv_id(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    pdfs_dir = os.getenv("PDFS_DIR", "./data/pdfs")
    os.makedirs(pdfs_dir, exist_ok=True)
    paper_id = str(uuid.uuid4())
    pdf_path = os.path.join(pdfs_dir, f"{paper_id}.pdf")

    try:
        download_arxiv_pdf(arxiv_id, pdf_path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to download PDF from arXiv: {e}")

    paper = Paper(
        id=paper_id,
        title="",
        pdf_path=pdf_path,
        processing_status="awaiting_metadata",
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    background_tasks.add_task(_extract_metadata_bg, paper.id, pdf_path)
    return paper


@router.get("/venues")
def list_venues(db: Session = Depends(get_db)):
    """
    Return all distinct (venue, year) combinations with paper counts.
    Only includes papers with a non-null, non-empty venue.
    """
    from sqlalchemy import func

    rows = (
        db.query(Paper.venue, Paper.year, func.count(Paper.id).label("count"))
        .filter(Paper.venue != None, Paper.venue != "")
        .group_by(Paper.venue, Paper.year)
        .order_by(Paper.venue, Paper.year.desc())
        .all()
    )

    # Aggregate: per-venue total, then per-venue-year breakdown
    venues: dict[str, dict] = {}
    for venue, year, count in rows:
        if venue not in venues:
            venues[venue] = {"venue": venue, "total": 0, "years": []}
        venues[venue]["total"] += count
        if year is not None:
            venues[venue]["years"].append({"year": year, "count": count})

    # Sort years descending within each venue
    result = sorted(venues.values(), key=lambda v: -v["total"])
    return result


@router.get("")
def list_papers(q: Optional[str] = None, venue: Optional[str] = None, year: Optional[int] = None, db: Session = Depends(get_db)):
    """List all papers with their ContentItems. Optionally filter by title/author (q), venue, or year."""
    query = db.query(Paper)
    if q:
        like = f"%{q}%"
        query = query.filter(
            Paper.title.ilike(like) | Paper.authors.ilike(like)
        )
    if venue:
        query = query.filter(Paper.venue.ilike(f"%{venue}%"))
    if year:
        query = query.filter(Paper.year == year)
    papers = query.order_by(Paper.uploaded_at.desc()).all()

    result = []
    for paper in papers:
        items = db.query(ContentItem).filter(ContentItem.paper_id == paper.id).all()
        result.append(_paper_out(paper, items))
    return result


@router.get("/{paper_id}")
def get_paper(paper_id: str, db: Session = Depends(get_db)):
    """Get a single paper with all its ContentItems."""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    items = db.query(ContentItem).filter(ContentItem.paper_id == paper_id).all()
    return _paper_out(paper, items)


@router.get("/{paper_id}/metadata", response_model=PaperMetadataResponse)
def get_paper_metadata(paper_id: str, db: Session = Depends(get_db)):
    paper = db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    if paper.raw_extracted_metadata is None:
        return PaperMetadataResponse(id=paper_id, status="extracting")

    vlm_data = json.loads(paper.raw_extracted_metadata) if paper.raw_extracted_metadata else {}
    scholar_data = json.loads(paper.scholar_metadata) if paper.scholar_metadata else {}

    return PaperMetadataResponse(
        id=paper_id,
        status="ready",
        vlm_result=VlmMetadataResult(**vlm_data) if vlm_data else None,
        scholar_suggestion=ScholarSuggestion(**scholar_data) if scholar_data else None,
    )


@router.post("/{paper_id}/metadata", response_model=PaperOut)
def confirm_paper_metadata(
    paper_id: str,
    body: MetadataConfirm,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    paper = db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper.title = body.title
    paper.authors = body.authors
    paper.year = body.year
    paper.venue = body.venue
    paper.institution = body.institution
    paper.doi = body.doi
    paper.processing_status = "pending"
    db.commit()
    db.refresh(paper)

    background_tasks.add_task(_process_paper_bg, paper.id, paper.pdf_path)
    return paper


@router.get("/{paper_id}/full")
def get_full_analysis(paper_id: str, db: Session = Depends(get_db)):
    """Full analysis view — same as detail but semantically distinct for the frontend."""
    return get_paper(paper_id, db)


@router.post("/{paper_id}/confirm")
def confirm_items(
    paper_id: str,
    body: ConfirmItemsRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Bulk-update module_type for extracted images.
    Non-'other' items immediately get background VLM analysis scheduled.
    """
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    to_analyze: list[str] = []
    for conf in body.confirmations:
        item = db.query(ContentItem).filter(
            ContentItem.id == conf.item_id,
            ContentItem.paper_id == paper_id,
        ).first()
        if not item:
            continue
        item.module_type = conf.module_type
        if conf.module_type != "other":
            item.processing_status = "pending"
            to_analyze.append(conf.item_id)

    db.commit()

    for item_id in to_analyze:
        background_tasks.add_task(_analyze_item_bg, item_id)

    return {"status": "ok", "analyzing": len(to_analyze)}


@router.post("/{paper_id}/reprocess")
def reprocess_paper(
    paper_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Re-trigger the processing pipeline for a paper that failed."""
    paper = db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if paper.processing_status not in ("failed", "done"):
        raise HTTPException(status_code=400, detail="Paper is not in a reprocessable state")

    # Remove existing content items so the pipeline starts fresh
    from models.annotation import UserAnnotation
    item_ids = [i.id for i in db.query(ContentItem).filter(ContentItem.paper_id == paper_id).all()]
    if item_ids:
        db.query(UserAnnotation).filter(UserAnnotation.item_id.in_(item_ids)).delete(synchronize_session=False)
    db.query(ContentItem).filter(ContentItem.paper_id == paper_id).delete(synchronize_session=False)

    paper.processing_status = "pending"
    db.commit()

    background_tasks.add_task(_process_paper_bg, paper.id, paper.pdf_path)
    items = db.query(ContentItem).filter(ContentItem.paper_id == paper_id).all()
    return _paper_out(paper, items)


@router.delete("/{paper_id}", status_code=204)
def delete_paper(paper_id: str, db: Session = Depends(get_db)):
    import shutil
    from models.annotation import UserAnnotation
    from models.topic import TopicPaper

    paper = db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # 1. Delete annotations for all content items belonging to this paper
    item_ids = [i.id for i in db.query(ContentItem).filter(ContentItem.paper_id == paper_id).all()]
    if item_ids:
        db.query(UserAnnotation).filter(UserAnnotation.item_id.in_(item_ids)).delete(synchronize_session=False)

    # 2. Delete content items
    db.query(ContentItem).filter(ContentItem.paper_id == paper_id).delete(synchronize_session=False)

    # 3. Delete topic associations
    db.query(TopicPaper).filter(TopicPaper.paper_id == paper_id).delete(synchronize_session=False)

    # 4. Delete the paper record
    db.delete(paper)
    db.commit()

    # 5. Clean up physical files (non-fatal if already missing)
    pdf_path = paper.pdf_path
    if pdf_path and os.path.isfile(pdf_path):
        try:
            os.remove(pdf_path)
        except OSError as e:
            logger.warning("Could not delete PDF file %s: %s", pdf_path, e)

    figures_dir = os.path.join(FIGURES_DIR, paper_id)
    if os.path.isdir(figures_dir):
        try:
            shutil.rmtree(figures_dir)
        except OSError as e:
            logger.warning("Could not delete figures dir %s: %s", figures_dir, e)
