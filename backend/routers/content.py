import json
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models.content_item import ContentItem
from models.annotation import UserAnnotation
from schemas import AnnotationCreate, AnnotationOut
import uuid

router = APIRouter()


# ---------------------------------------------------------------------------
# Serialisation helper
# ---------------------------------------------------------------------------

def _item_out(item: ContentItem) -> dict:
    d = {c.name: getattr(item, c.name) for c in item.__table__.columns}
    d.pop("embedding_vector", None)
    if d.get("analysis_json"):
        try:
            d["analysis_json"] = json.loads(d["analysis_json"])
        except Exception:
            d["analysis_json"] = None
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()
    return d


def _annotation_out(ann: UserAnnotation) -> dict:
    d = {c.name: getattr(ann, c.name) for c in ann.__table__.columns}
    if isinstance(d.get("tags"), str):
        try:
            d["tags"] = json.loads(d["tags"])
        except Exception:
            d["tags"] = []
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()
    return d


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/search")
def search_content(
    q: str = Query(..., min_length=1),
    module_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Semantic search (vector) with LIKE fallback.
    Returns ContentItems ordered by relevance.
    """
    # Try vector search first
    try:
        from services.embedder import search_similar
        ids = search_similar(q, module_type, top_k=20)
        if ids:
            items = db.query(ContentItem).filter(ContentItem.id.in_(ids)).all()
            order = {id_: i for i, id_ in enumerate(ids)}
            items.sort(key=lambda x: order.get(x.id, 999))
            return [_item_out(i) for i in items]
    except Exception:
        pass

    # Fallback: LIKE over caption + analysis_json
    like = f"%{q}%"
    query = db.query(ContentItem).filter(
        ContentItem.processing_status == "done",
        (ContentItem.caption.ilike(like) | ContentItem.analysis_json.ilike(like)),
    )
    if module_type:
        query = query.filter(ContentItem.module_type == module_type)
    return [_item_out(i) for i in query.limit(20).all()]


@router.get("")
def list_content(
    module_type: Optional[str] = Query(None),
    venue: Optional[str] = Query(None),
    paper_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List ContentItems with optional filters. Only returns done items by default."""
    from models.paper import Paper

    query = db.query(ContentItem).filter(ContentItem.processing_status == "done")

    if module_type:
        query = query.filter(ContentItem.module_type == module_type)
    if paper_id:
        query = query.filter(ContentItem.paper_id == paper_id)
    if venue:
        query = (
            query.join(Paper, ContentItem.paper_id == Paper.id)
            .filter(Paper.venue.ilike(f"%{venue}%"))
        )

    return [_item_out(i) for i in query.order_by(ContentItem.created_at.desc()).all()]


@router.get("/{item_id}")
def get_content_item(item_id: str, db: Session = Depends(get_db)):
    item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="ContentItem not found")
    return _item_out(item)


@router.get("/{item_id}/annotations")
def list_annotations(item_id: str, db: Session = Depends(get_db)):
    item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="ContentItem not found")
    anns = (
        db.query(UserAnnotation)
        .filter(UserAnnotation.item_id == item_id)
        .order_by(UserAnnotation.created_at.desc())
        .all()
    )
    return [_annotation_out(a) for a in anns]


@router.post("/{item_id}/annotations")
def add_annotation(item_id: str, body: AnnotationCreate, db: Session = Depends(get_db)):
    item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="ContentItem not found")

    ann = UserAnnotation(
        id=str(uuid.uuid4()),
        item_id=item_id,
        note_text=body.note_text,
        tags=json.dumps(body.tags),
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return _annotation_out(ann)


@router.delete("/{item_id}/annotations/{annotation_id}")
def delete_annotation(item_id: str, annotation_id: str, db: Session = Depends(get_db)):
    ann = db.query(UserAnnotation).filter(
        UserAnnotation.id == annotation_id,
        UserAnnotation.item_id == item_id,
    ).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")
    db.delete(ann)
    db.commit()
    return {"status": "deleted"}
