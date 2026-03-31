from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db

router = APIRouter()


@router.get("")
def list_content(
    module_type: str | None = Query(None),
    venue: str | None = Query(None),
    db: Session = Depends(get_db),
):
    # TODO: filter ContentItems by module_type, venue
    raise NotImplementedError


@router.get("/search")
def search_content(q: str = Query(...), module_type: str | None = Query(None)):
    # TODO: semantic search via embedding
    raise NotImplementedError


@router.get("/{item_id}")
def get_content_item(item_id: str, db: Session = Depends(get_db)):
    # TODO: return ContentItem + analysis_json
    raise NotImplementedError


@router.post("/{item_id}/annotations")
def add_annotation(item_id: str, db: Session = Depends(get_db)):
    # TODO: create UserAnnotation
    raise NotImplementedError
