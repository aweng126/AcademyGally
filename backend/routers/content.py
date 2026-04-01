import json
from fastapi import APIRouter, BackgroundTasks, Depends, Query, HTTPException
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


@router.get("/phrases")
def list_phrases(
    function: Optional[str] = Query(None),
    venue: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Aggregate key_phrases from all done abstract ContentItems.
    Returns flat list of phrase objects enriched with paper metadata.
    key_phrases are stored inside ContentItem.analysis_json (added by updated abstract.txt prompt).
    """
    from models.paper import Paper as PaperModel

    query = (
        db.query(ContentItem, PaperModel)
        .join(PaperModel, ContentItem.paper_id == PaperModel.id)
        .filter(
            ContentItem.module_type == "abstract",
            ContentItem.processing_status == "done",
            ContentItem.analysis_json.isnot(None),
        )
    )
    if venue:
        query = query.filter(PaperModel.venue.ilike(f"%{venue}%"))

    results = []
    for item, paper in query.all():
        try:
            data = json.loads(item.analysis_json)
            phrases = data.get("key_phrases", [])
        except Exception:
            continue
        for phrase in phrases:
            fn = phrase.get("function", "other")
            if function and fn != function:
                continue
            results.append({
                "item_id": item.id,
                "paper_id": paper.id,
                "paper_title": paper.title,
                "venue": paper.venue,
                "year": paper.year,
                "text": phrase.get("text", ""),
                "function": fn,
                "why_effective": phrase.get("why_effective", ""),
            })

    return results


@router.get("/phrases/favorites")
def list_phrase_favorites(db: Session = Depends(get_db)):
    """
    Return all phrase annotations (UserAnnotations with tag 'phrase_favorite'),
    enriched with paper metadata. Uses the existing UserAnnotation model.
    """
    from models.paper import Paper as PaperModel

    anns = (
        db.query(UserAnnotation)
        .filter(UserAnnotation.tags.contains("phrase_favorite"))
        .all()
    )
    results = []
    for ann in anns:
        item = db.query(ContentItem).filter(ContentItem.id == ann.item_id).first()
        paper = (
            db.query(PaperModel).filter(PaperModel.id == item.paper_id).first()
            if item
            else None
        )
        tags_list = []
        if isinstance(ann.tags, str):
            try:
                tags_list = json.loads(ann.tags)
            except Exception:
                tags_list = []
        else:
            tags_list = ann.tags or []

        results.append({
            "annotation_id": ann.id,
            "item_id": ann.item_id,
            "paper_id": item.paper_id if item else None,
            "paper_title": paper.title if paper else "Unknown",
            "text": ann.note_text,
            "tags": tags_list,
        })
    return results


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


@router.get("/{item_id}/similar")
def get_similar_items(item_id: str, top_k: int = Query(5, ge=1, le=20), db: Session = Depends(get_db)):
    """
    Find ContentItems similar to the given item using embedding similarity.
    Excludes the item itself. Falls back to empty list if embeddings unavailable.
    """
    item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="ContentItem not found")

    if not item.embedding_vector or not item.analysis_json:
        return []

    try:
        from services.embedder import search_similar
        # Search using the stored analysis_json as query text
        ids = search_similar(
            query=item.analysis_json,  # TEXT column — always str in ORM
            module_type=item.module_type,
            top_k=top_k + 1,  # +1 to account for self
        )
        ids = [i for i in ids if i != item_id][:top_k]
        if not ids:
            return []
        items = db.query(ContentItem).filter(ContentItem.id.in_(ids)).all()
        order = {id_: i for i, id_ in enumerate(ids)}
        items.sort(key=lambda x: order.get(x.id, 999))
        return [_item_out(i) for i in items]
    except Exception:
        return []


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


@router.post("/{item_id}/retry")
def retry_analysis(item_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Re-queue a failed ContentItem for VLM analysis."""
    item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="ContentItem not found")
    if item.module_type == "other":
        raise HTTPException(status_code=400, detail="Cannot analyze unclassified items")

    item.processing_status = "pending"
    db.commit()

    from routers.papers import _analyze_item_bg
    background_tasks.add_task(_analyze_item_bg, item_id)
    return {"status": "queued", "item_id": item_id}
