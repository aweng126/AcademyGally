import os
import uuid
import json
from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db, SessionLocal
from models.paper import Paper
from models.content_item import ContentItem
from schemas import ConfirmItemsRequest
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
        except Exception:
            pass  # Abstract extraction failure is non-fatal

        paper.processing_status = "done"
        db.commit()
    except Exception:
        db.rollback()
        paper = db.query(Paper).filter(Paper.id == paper_id).first()
        if paper:
            paper.processing_status = "failed"
            db.commit()
        return
    finally:
        db.close()

    # Trigger abstract VLM analysis outside the DB session (non-fatal)
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
        except Exception:
            pass

        item.processing_status = "done"
        db.commit()
    except Exception:
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

@router.post("")
async def upload_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    venue: str = Form(None),
    year: int = Form(None),
    authors: str = Form(None),
    doi: str = Form(None),
    db: Session = Depends(get_db),
):
    """Upload a PDF and trigger background image extraction."""
    os.makedirs(PDFS_DIR, exist_ok=True)
    paper_id = str(uuid.uuid4())
    pdf_path = os.path.join(PDFS_DIR, f"{paper_id}.pdf")

    content = await file.read()
    with open(pdf_path, "wb") as f:
        f.write(content)

    paper = Paper(
        id=paper_id,
        title=title,
        venue=venue,
        year=year,
        authors=authors,
        doi=doi,
        pdf_path=pdf_path,
        processing_status="pending",
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    background_tasks.add_task(_process_paper_bg, paper_id, pdf_path)
    return _paper_out(paper, [])


@router.get("")
def list_papers(q: Optional[str] = None, venue: Optional[str] = None, db: Session = Depends(get_db)):
    """List all papers with their ContentItems. Optionally filter by title/author (q) or venue."""
    query = db.query(Paper)
    if q:
        like = f"%{q}%"
        query = query.filter(
            Paper.title.ilike(like) | Paper.authors.ilike(like)
        )
    if venue:
        query = query.filter(Paper.venue.ilike(f"%{venue}%"))
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
