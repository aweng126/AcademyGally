import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.annotation import UserAnnotation
from models.content_item import ContentItem
from models.paper import Paper
from models.summary import UserSummary

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class NoteItemOut(BaseModel):
    annotation_id: str
    item_id: str
    paper_id: str
    paper_title: str
    venue: Optional[str]
    year: Optional[int]
    module_type: str
    item_caption: Optional[str]
    note_text: str
    tags: list[str]
    created_at: str


class ModuleSummaryOut(BaseModel):
    module_type: str
    principles: Optional[str]
    materials: Optional[str]
    updated_at: Optional[str]


class ModuleSummaryIn(BaseModel):
    principles: Optional[str] = None
    materials: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_tags(raw: str) -> list[str]:
    if not raw:
        return []
    try:
        return json.loads(raw)
    except Exception:
        return []


def _summary_out(row: UserSummary) -> dict:
    return {
        "module_type": row.module_type,
        "principles": row.principles,
        "materials": row.materials,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/items", response_model=list[NoteItemOut])
def get_notes_by_module(
    module_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return all user notes (UserAnnotation) for a given module_type.

    Excludes phrase_favorite sentinel annotations.
    Enriches each note with paper metadata.
    """
    query = (
        db.query(UserAnnotation, ContentItem, Paper)
        .join(ContentItem, UserAnnotation.item_id == ContentItem.id)
        .join(Paper, ContentItem.paper_id == Paper.id)
    )
    if module_type:
        query = query.filter(ContentItem.module_type == module_type)

    rows = query.order_by(UserAnnotation.created_at.desc()).all()

    result = []
    for ann, item, paper in rows:
        tags = _parse_tags(ann.tags)
        # Skip phrase_favorite sentinel annotations
        if "phrase_favorite" in tags:
            continue
        result.append({
            "annotation_id": ann.id,
            "item_id": item.id,
            "paper_id": paper.id,
            "paper_title": paper.title,
            "venue": paper.venue,
            "year": paper.year,
            "module_type": item.module_type,
            "item_caption": item.caption,
            "note_text": ann.note_text,
            "tags": tags,
            "created_at": ann.created_at.isoformat(),
        })
    return result


@router.get("/summary/{module_type}", response_model=ModuleSummaryOut)
def get_module_summary(module_type: str, db: Session = Depends(get_db)):
    """Return the user's summary (principles + materials) for a module type.

    Returns empty strings if no summary exists yet — never 404.
    """
    row = db.query(UserSummary).filter(UserSummary.module_type == module_type).first()
    if not row:
        return {
            "module_type": module_type,
            "principles": None,
            "materials": None,
            "updated_at": None,
        }
    return _summary_out(row)


@router.put("/summary/{module_type}", response_model=ModuleSummaryOut)
def update_module_summary(
    module_type: str,
    body: ModuleSummaryIn,
    db: Session = Depends(get_db),
):
    """Upsert the user's summary for a module type."""
    row = db.query(UserSummary).filter(UserSummary.module_type == module_type).first()
    if not row:
        row = UserSummary(module_type=module_type)
        db.add(row)

    if body.principles is not None:
        row.principles = body.principles
    if body.materials is not None:
        row.materials = body.materials
    row.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(row)
    return _summary_out(row)
