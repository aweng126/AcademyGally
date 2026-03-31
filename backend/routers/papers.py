from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db

router = APIRouter()


@router.post("")
async def upload_paper(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # TODO: save PDF, create Paper record, trigger async processing pipeline
    raise NotImplementedError


@router.get("")
def list_papers(db: Session = Depends(get_db)):
    # TODO: return all papers with processing status
    raise NotImplementedError


@router.get("/{paper_id}")
def get_paper(paper_id: str, db: Session = Depends(get_db)):
    # TODO: return paper detail + all ContentItems
    raise NotImplementedError


@router.get("/{paper_id}/full")
def get_full_analysis(paper_id: str, db: Session = Depends(get_db)):
    # TODO: return full analysis view data
    raise NotImplementedError
