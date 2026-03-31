import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TopicPaper(Base):
    __tablename__ = "topic_papers"

    topic_id: Mapped[str] = mapped_column(String, ForeignKey("topics.id"), primary_key=True)
    paper_id: Mapped[str] = mapped_column(String, ForeignKey("papers.id"), primary_key=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    progress_json: Mapped[str] = mapped_column(
        Text, default='{"abstract": false, "arch_figure": false, "eval_figure": false}'
    )
