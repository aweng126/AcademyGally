import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.topic import Topic, TopicPaper
from models.paper import Paper
from models.content_item import ContentItem
from schemas import TopicCreate, TopicPaperAdd, ProgressUpdate

router = APIRouter()


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
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()
    return d


def _paper_out(paper: Paper, items: list[ContentItem]) -> dict:
    d = {c.name: getattr(paper, c.name) for c in paper.__table__.columns}
    if d.get("uploaded_at"):
        d["uploaded_at"] = d["uploaded_at"].isoformat()
    d["content_items"] = [_item_out(i) for i in items]
    return d


def _topic_paper_out(tp: TopicPaper, db: Session) -> dict:
    paper = db.query(Paper).filter(Paper.id == tp.paper_id).first()
    items = db.query(ContentItem).filter(ContentItem.paper_id == tp.paper_id).all() if paper else []
    progress = tp.progress_json
    if isinstance(progress, str):
        try:
            progress = json.loads(progress)
        except Exception:
            progress = {}
    return {
        "topic_id": tp.topic_id,
        "paper_id": tp.paper_id,
        "order": tp.order,
        "progress_json": progress,
        "paper": _paper_out(paper, items) if paper else None,
    }


def _topic_out(topic: Topic, db: Session) -> dict:
    tps = (
        db.query(TopicPaper)
        .filter(TopicPaper.topic_id == topic.id)
        .order_by(TopicPaper.order)
        .all()
    )
    return {
        "id": topic.id,
        "name": topic.name,
        "description": topic.description,
        "created_at": topic.created_at.isoformat(),
        "papers": [_topic_paper_out(tp, db) for tp in tps],
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("")
def list_topics(db: Session = Depends(get_db)):
    topics = db.query(Topic).order_by(Topic.created_at.desc()).all()
    return [_topic_out(t, db) for t in topics]


@router.post("")
def create_topic(body: TopicCreate, db: Session = Depends(get_db)):
    topic = Topic(id=str(uuid.uuid4()), name=body.name, description=body.description)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return _topic_out(topic, db)


@router.get("/{topic_id}")
def get_topic(topic_id: str, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return _topic_out(topic, db)


@router.post("/{topic_id}/papers")
def add_paper_to_topic(topic_id: str, body: TopicPaperAdd, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    existing = db.query(TopicPaper).filter(
        TopicPaper.topic_id == topic_id,
        TopicPaper.paper_id == body.paper_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Paper already in topic")

    tp = TopicPaper(
        topic_id=topic_id,
        paper_id=body.paper_id,
        order=body.order,
        progress_json=json.dumps({"abstract": False, "arch_figure": False, "eval_figure": False}),
    )
    db.add(tp)
    db.commit()
    return _topic_paper_out(tp, db)


@router.patch("/{topic_id}/papers/{paper_id}")
def update_paper_progress(
    topic_id: str,
    paper_id: str,
    body: ProgressUpdate,
    db: Session = Depends(get_db),
):
    tp = db.query(TopicPaper).filter(
        TopicPaper.topic_id == topic_id,
        TopicPaper.paper_id == paper_id,
    ).first()
    if not tp:
        raise HTTPException(status_code=404, detail="TopicPaper not found")

    tp.progress_json = json.dumps(body.progress_json)
    db.commit()
    return _topic_paper_out(tp, db)


@router.delete("/{topic_id}/papers/{paper_id}")
def remove_paper_from_topic(topic_id: str, paper_id: str, db: Session = Depends(get_db)):
    tp = db.query(TopicPaper).filter(
        TopicPaper.topic_id == topic_id,
        TopicPaper.paper_id == paper_id,
    ).first()
    if not tp:
        raise HTTPException(status_code=404, detail="TopicPaper not found")
    db.delete(tp)
    db.commit()
    return {"status": "removed"}
