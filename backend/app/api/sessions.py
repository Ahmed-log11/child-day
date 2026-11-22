"""Sessions, dashboard summary and alerts. Mock data for now."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import mocks

router = APIRouter(tags=["reports"])


def _report() -> dict:
    return mocks.load("session_report")


@router.get("/sessions")
def list_sessions():
    r = _report()
    return [{
        "id": r["id"], "date": r["date"], "duration_s": r["video"]["duration_s"],
        "children": [c["id"] for c in r["children"]], "alerts": len(r["events"]),
    }]


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    r = _report()
    if session_id != r["id"]:
        raise HTTPException(404, "Session not found")
    return r


@router.get("/sessions/{session_id}/frames")
def get_frames(session_id: str):
    r = _report()
    if session_id != r["id"]:
        raise HTTPException(404, "Session not found")
    return mocks.mock_frames(r)


@router.get("/summary")
def get_summary(range: str = "week", child_id: str | None = None, end_date: str | None = None):
    if range not in ("day", "week", "month"):
        raise HTTPException(422, "range must be day, week or month")
    return mocks.load("summary_week")  # same mock for every range for now


@router.get("/alerts")
def list_alerts(range: str = "week", end_date: str | None = None, type: str | None = None):
    r = _report()
    events = [{**e, "session_id": r["id"], "date": r["date"]} for e in r["events"]]
    return [e for e in events if type is None or e["type"] == type]


class AlertUpdate(BaseModel):
    reviewed: bool


@router.patch("/alerts/{event_id}")
def update_alert(event_id: str, body: AlertUpdate):
    for e in _report()["events"]:
        if e["id"] == event_id:
            return {**e, "reviewed": body.reviewed}  # not saved while on mock data
    raise HTTPException(404, "Alert not found")
