"""Saving finished reports (from an upload or a live session) and reading their frames back."""
import json
from datetime import date, datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session as DbSession

from app.config import settings
from app.db.models import Session as SessionRow


def frames_path(session_id: str) -> Path:
    folder = settings.storage_dir / "frames"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{session_id}.json"


def save_report(db: DbSession, report: dict, frames: dict | None, *, source: str,
                session_date: date, video_url: str | None = None) -> SessionRow:
    """Store the Engine's report as a new session. Returns the saved row."""
    row = SessionRow(date=session_date, source=source)
    db.add(row)
    db.flush()  # gives row.id
    sid = row.id

    report = dict(report)
    video = dict(report.get("video") or {})
    video["url"] = video_url
    report.update({
        "id": sid,
        "date": session_date.isoformat(),
        "source": source,
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "video": video,
        # Engine ids (e1, e2...) restart every session; make them unique: "<session>-e1"
        "events": [{**e, "id": f"{sid}-{e['id']}"} for e in report.get("events", [])],
    })
    row.duration_s = float(video.get("duration_s") or 0)
    row.video_url = video_url
    row.report = report
    db.commit()

    if frames is not None:  # an upload writes its frames file itself (run_video)
        frames_path(sid).write_text(json.dumps(frames))
    return row


def read_frames(session_id: str, analyzed_fps: float) -> dict:
    path = frames_path(session_id)
    if not path.exists():
        return {"analyzed_fps": analyzed_fps, "frames": []}
    return json.loads(path.read_text())
