from datetime import datetime
from typing import Optional
from sqlalchemy import Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class UserSummary(Base):
    __tablename__ = "user_summary"

    module_type: Mapped[str] = mapped_column(Text, primary_key=True)
    principles: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    materials: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
