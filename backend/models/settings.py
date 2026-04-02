from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class UserProfile(Base):
    __tablename__ = "user_profile"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    display_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    institution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    research_area: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    research_interests: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array
    academic_stage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_view: Mapped[str] = mapped_column(Text, nullable=False, default="library")
    analysis_language: Mapped[str] = mapped_column(Text, nullable=False, default="english")
    auto_retry: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # boolean
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class ModelConfig(Base):
    __tablename__ = "model_config"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    preset: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    anthropic_api_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vlm_api_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vlm_base_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vlm_model: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vlm_text_model: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_tested_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_test_status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_test_latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
