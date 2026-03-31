from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Any, Literal, Optional
import json


class ContentItemOut(BaseModel):
    id: str
    paper_id: str
    module_type: str
    image_path: Optional[str] = None
    page_number: Optional[int] = None
    caption: Optional[str] = None
    analysis_json: Optional[Any] = None
    processing_status: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("analysis_json", mode="before")
    @classmethod
    def parse_analysis(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return v


class PaperOut(BaseModel):
    id: str
    title: str
    venue: Optional[str] = None
    year: Optional[int] = None
    authors: Optional[str] = None
    doi: Optional[str] = None
    institution: Optional[str] = None
    pdf_path: str
    processing_status: str
    uploaded_at: datetime
    content_items: list[ContentItemOut] = []

    model_config = {"from_attributes": True}


class TopicCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TopicPaperAdd(BaseModel):
    paper_id: str
    order: int = 0


class ProgressUpdate(BaseModel):
    progress_json: dict[str, bool]


class AnnotationCreate(BaseModel):
    note_text: str
    tags: list[str] = []


class AnnotationOut(BaseModel):
    id: str
    item_id: str
    note_text: str
    tags: list[str] = []
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []


class ConfirmItemEntry(BaseModel):
    item_id: str
    module_type: Literal["arch_figure", "eval_figure", "abstract", "algorithm", "other"]


class ConfirmItemsRequest(BaseModel):
    confirmations: list[ConfirmItemEntry]


class VlmMetadataResult(BaseModel):
    title: Optional[str] = None
    authors: Optional[list[str]] = None
    year: Optional[int] = None
    venue: Optional[str] = None
    institution: Optional[str] = None


class ScholarSuggestion(BaseModel):
    title: Optional[str] = None
    authors: Optional[list[str]] = None
    year: Optional[int] = None
    venue: Optional[str] = None
    doi: Optional[str] = None


class PaperMetadataResponse(BaseModel):
    id: str
    status: str
    vlm_result: Optional[VlmMetadataResult] = None
    scholar_suggestion: Optional[ScholarSuggestion] = None


class MetadataConfirm(BaseModel):
    title: str
    authors: Optional[str] = None
    year: Optional[int] = None
    venue: Optional[str] = None
    institution: Optional[str] = None
    doi: Optional[str] = None
