import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Enum as SAEnum, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class ContentItem(Base):
    __tablename__ = "content_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    paper_id: Mapped[str] = mapped_column(String, ForeignKey("papers.id"), nullable=False)
    module_type: Mapped[str] = mapped_column(
        SAEnum("arch_figure", "abstract", "eval_figure", "algorithm", "other", name="module_type"),
        nullable=False,
        default="other",
    )
    image_path: Mapped[str] = mapped_column(String, nullable=True)
    page_number: Mapped[int] = mapped_column(Integer, nullable=True)
    caption: Mapped[str] = mapped_column(Text, nullable=True)
    analysis_json: Mapped[str] = mapped_column(Text, nullable=True)
    embedding_vector: Mapped[bytes] = mapped_column(LargeBinary, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        SAEnum("pending", "processing", "done", "failed", name="item_status"),
        default="pending",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
