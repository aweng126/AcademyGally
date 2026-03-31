from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db

router = APIRouter()


@router.get("")
def list_topics(db: Session = Depends(get_db)):
    # TODO: return all topics with paper count and progress summary
    raise NotImplementedError


@router.post("")
def create_topic(db: Session = Depends(get_db)):
    # TODO: create Topic
    raise NotImplementedError


@router.post("/{topic_id}/papers")
def add_paper_to_topic(topic_id: str, db: Session = Depends(get_db)):
    # TODO: create TopicPaper association
    raise NotImplementedError


@router.patch("/{topic_id}/papers/{paper_id}")
def update_paper_progress(topic_id: str, paper_id: str, db: Session = Depends(get_db)):
    # TODO: update TopicPaper.progress_json
    raise NotImplementedError
