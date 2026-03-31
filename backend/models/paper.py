import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Enum as SAEnum, Text
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String, nullable=False, default="")
    venue: Mapped[str] = mapped_column(String, nullable=True)
    year: Mapped[int] = mapped_column(nullable=True)
    authors: Mapped[str] = mapped_column(String, nullable=True)
    doi: Mapped[str] = mapped_column(String, nullable=True)
    institution: Mapped[str] = mapped_column(String, nullable=True)
    pdf_path: Mapped[str] = mapped_column(String, nullable=False)
    processing_status: Mapped[str] = mapped_column(
        SAEnum("awaiting_metadata", "pending", "processing", "done", "failed", name="paper_status"),
        default="awaiting_metadata",
    )
    raw_extracted_metadata: Mapped[str] = mapped_column(Text, nullable=True)
    scholar_metadata: Mapped[str] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
