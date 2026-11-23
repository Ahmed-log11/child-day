"""Database tables. Field names match docs/api.md."""
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


class Child(Base):
    __tablename__ = "children"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("c"))
    name: Mapped[str] = mapped_column(String)
    age_group: Mapped[str] = mapped_column(String)  # "3-4" or "5-12"
    color: Mapped[str | None] = mapped_column(String, nullable=True)  # "#7B5CC6", chosen in setup


class Zone(Base):
    __tablename__ = "zones"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("z"))
    name: Mapped[str] = mapped_column(String)
    polygon: Mapped[list] = mapped_column(JSON)  # [[x, y], ...] normalized 0-1


class Session(Base):
    """One analyzed video, or one live session."""
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("s"))
    date: Mapped[date] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String, default="upload")  # "upload" or "live"
    duration_s: Mapped[float] = mapped_column(Float, default=0)
    video_url: Mapped[str | None] = mapped_column(String, nullable=True)
    report: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # full session report
    is_demo_data: Mapped[bool] = mapped_column(Boolean, default=False)


class Segment(Base):
    __tablename__ = "segments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"))
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id"))
    category: Mapped[str] = mapped_column(String)  # screen / activity / presence
    state: Mapped[str] = mapped_column(String)
    start_s: Mapped[float] = mapped_column(Float)
    end_s: Mapped[float] = mapped_column(Float)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("e"))
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"))
    child_id: Mapped[str | None] = mapped_column(ForeignKey("children.id"), nullable=True)
    type: Mapped[str] = mapped_column(String)  # fall / danger_zone / violent_contact
    start_s: Mapped[float] = mapped_column(Float)
    end_s: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    zone_id: Mapped[str | None] = mapped_column(ForeignKey("zones.id"), nullable=True)
    clip_url: Mapped[str | None] = mapped_column(String, nullable=True)
    reviewed: Mapped[bool] = mapped_column(Boolean, default=False)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("j"))
    status: Mapped[str] = mapped_column(String, default="queued")  # queued/processing/done/failed
    progress: Mapped[int] = mapped_column(Integer, default=0)
    step: Mapped[str] = mapped_column(String, default="Waiting")
    session_id: Mapped[str | None] = mapped_column(String, nullable=True)
    error: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
