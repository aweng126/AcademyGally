import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models.content_item import ContentItem
from models.paper import Paper
from services.vlm_analyzer import analyze_text

logger = logging.getLogger(__name__)
router = APIRouter()


class CoachRequest(BaseModel):
    draft_text: str
    mode: str  # "abstract" | "intro_paragraph" | "related_work_paragraph"
    exemplar_item_ids: Optional[list[str]] = None  # up to 5 abstract item IDs


class CoachIssue(BaseModel):
    dimension: str
    severity: str
    description: str
    suggestion: str
    exemplar_ref: Optional[int] = None


class CoachExemplarUsed(BaseModel):
    item_id: str
    paper_title: str
    snippet: str


class CoachResponse(BaseModel):
    overall_score: int
    summary: str
    strengths: list[str]
    issues: list[CoachIssue]
    suggested_rewrite: str
    positioning_notes: Optional[str] = None
    exemplars_used: list[CoachExemplarUsed]


@router.post("/feedback", response_model=CoachResponse)
def get_writing_feedback(body: CoachRequest, db: Session = Depends(get_db)):
    if not body.draft_text.strip():
        raise HTTPException(status_code=400, detail="draft_text is required")
    if body.mode not in ("abstract", "intro_paragraph", "related_work_paragraph"):
        raise HTTPException(status_code=400, detail="mode must be one of: abstract, intro_paragraph, related_work_paragraph")

    # Fetch exemplar passages (abstract ContentItems only)
    exemplars = []
    if body.exemplar_item_ids:
        for item_id in body.exemplar_item_ids[:5]:
            item = db.query(ContentItem).filter(
                ContentItem.id == item_id,
                ContentItem.module_type == "abstract",
                ContentItem.processing_status == "done",
            ).first()
            if item and item.caption:
                paper = db.query(Paper).filter(Paper.id == item.paper_id).first()
                exemplars.append({
                    "item_id": item_id,
                    "paper_title": paper.title if paper else "Unknown",
                    "text": item.caption,
                })

    # Build exemplar block
    exemplar_block = ""
    if exemplars:
        exemplar_block = "\n\nExemplar passages from the student's library:\n"
        for i, ex in enumerate(exemplars, 1):
            exemplar_block += f"\n[Exemplar {i}] From: \"{ex['paper_title']}\"\n{ex['text']}\n"

    mode_label = {
        "abstract": "paper abstract",
        "intro_paragraph": "introduction paragraph",
        "related_work_paragraph": "related work paragraph",
    }[body.mode]

    full_text = (
        f"Mode: {mode_label}\n\n"
        f"Student's draft {mode_label}:\n---\n{body.draft_text}\n---"
        f"{exemplar_block}"
    )

    try:
        result = analyze_text(full_text, "writing_coach")
    except Exception as e:
        logger.error("Writing coach VLM call failed: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="AI analysis failed. Please try again.")

    exemplars_used = [
        CoachExemplarUsed(
            item_id=ex["item_id"],
            paper_title=ex["paper_title"],
            snippet=ex["text"][:200],
        )
        for ex in exemplars
    ]

    issues_raw = result.get("issues", [])
    issues = []
    for issue in issues_raw:
        issues.append(CoachIssue(
            dimension=issue.get("dimension", "other"),
            severity=issue.get("severity", "moderate"),
            description=issue.get("description", ""),
            suggestion=issue.get("suggestion", ""),
            exemplar_ref=issue.get("exemplar_ref"),
        ))

    return CoachResponse(
        overall_score=int(result.get("overall_score", 3)),
        summary=result.get("summary", ""),
        strengths=result.get("strengths", []),
        issues=issues,
        suggested_rewrite=result.get("suggested_rewrite", ""),
        positioning_notes=result.get("positioning_notes"),
        exemplars_used=exemplars_used,
    )
