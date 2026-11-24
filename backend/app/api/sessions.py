"""Sessions, dashboard summary and alerts.

Real sessions come from the database (saved after an upload or a live session).
The mock session "s1" stays available as a demo fallback, and "latest" means the
newest real session, or the mock one while there is none yet.
The week/month summary is still sample data.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession
from sqlalchemy.orm.attributes import flag_modified

from app import mocks
from app.db.models import Session as SessionRow
from app.db.session import get_db
from app.reports import read_frames

router = APIRouter(tags=["reports"])

MOCK_ID = "s1"


def _mock() -> dict:
    return mocks.load("session_report")


def _real_reports(db: DbSession) -> list[dict]:
    """All saved reports, newest first."""
    rows = db.scalars(select(SessionRow)).all()
    reports = [r.report for r in rows if r.report]
    return sorted(reports, key=lambda r: r.get("saved_at", ""), reverse=True)


def _summary_row(r: dict) -> dict:
    return {
        "id": r["id"], "date": r["date"], "duration_s": r["video"]["duration_s"],
        "children": [c["id"] for c in r["children"]], "alerts": len(r["events"]),
    }


@router.get("/sessions")
def list_sessions(db: DbSession = Depends(get_db)):
    reports = _real_reports(db) or [_mock()]
    return [_summary_row(r) for r in reports]


@router.get("/sessions/latest")
def latest_session(db: DbSession = Depends(get_db)):
    reports = _real_reports(db)
    return reports[0] if reports else _mock()


@router.get("/sessions/{session_id}")
def get_session(session_id: str, db: DbSession = Depends(get_db)):
    if session_id == MOCK_ID:
        return _mock()
    row = db.get(SessionRow, session_id)
    if not row or not row.report:
        raise HTTPException(404, "Session not found")
    return row.report


@router.get("/sessions/{session_id}/frames")
def get_frames(session_id: str, db: DbSession = Depends(get_db)):
    if session_id == MOCK_ID:
        return mocks.mock_frames(_mock())
    row = db.get(SessionRow, session_id)
    if not row or not row.report:
        raise HTTPException(404, "Session not found")
    return read_frames(session_id, row.report["video"].get("analyzed_fps", 3))


@router.get("/summary")
def get_summary(range: str = "week", child_id: str | None = None, end_date: str | None = None):
    if range not in ("day", "week", "month"):
        raise HTTPException(422, "range must be day, week or month")
    return mocks.load("summary_week")  # sample history


@router.get("/alerts")
def list_alerts(range: str = "week", end_date: str | None = None, type: str | None = None,
                db: DbSession = Depends(get_db)):
    reports = _real_reports(db) or [_mock()]
    events = [{**e, "session_id": r["id"], "date": r["date"]} for r in reports for e in r["events"]]
    return [e for e in events if type is None or e["type"] == type]


class AlertUpdate(BaseModel):
    reviewed: bool


@router.patch("/alerts/{event_id}")
def update_alert(event_id: str, body: AlertUpdate, db: DbSession = Depends(get_db)):
    if "-" in event_id:  # real events are "<session_id>-e1"
        row = db.get(SessionRow, event_id.split("-")[0])
        if row and row.report:
            report = dict(row.report)
            for e in report["events"]:
                if e["id"] == event_id:
                    e["reviewed"] = body.reviewed
                    row.report = report
                    flag_modified(row, "report")
                    db.commit()
                    return {**e, "session_id": report["id"], "date": report["date"]}
    for e in _mock()["events"]:
        if e["id"] == event_id:
            return {**e, "reviewed": body.reviewed}  # mock events are not saved
    raise HTTPException(404, "Alert not found")
