"""Advice for a child's day and answers on the Ask page, written by Claude (app/advice.py).

When Claude is not set up (no ANTHROPIC_API_KEY) or the call fails, "advice" is null and
"source" is "none": the frontend then shows its own rule-based advice.
Advice is saved in the report, so each child and language costs one call per session.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DbSession
from sqlalchemy.orm.attributes import flag_modified

from app import advice
from app.api.sessions import MOCK_ID, _mock, _real_reports
from app.db.models import Session as SessionRow
from app.db.session import get_db

router = APIRouter(tags=["insights"])

_mock_cache: dict[str, list] = {}


def _report(db: DbSession, session_id: str | None) -> tuple[dict, SessionRow | None]:
    if session_id in (None, "latest"):
        reports = _real_reports(db)
        if not reports:
            return _mock(), None
        session_id = reports[0]["id"]
    if session_id == MOCK_ID:
        return _mock(), None
    row = db.get(SessionRow, session_id)
    if not row or not row.report:
        raise HTTPException(404, "Session not found")
    return row.report, row


class DayRequest(BaseModel):
    session_id: str | None = None
    child_id: str
    lang: str = "en"


@router.post("/insights/day")
def day(body: DayRequest, db: DbSession = Depends(get_db)):
    report, row = _report(db, body.session_id)
    if not any(c["id"] == body.child_id for c in report["children"]):
        raise HTTPException(404, "Child not in this session")
    key = f"{body.child_id}:{body.lang}"
    saved = (report.get("advice") or {}).get(key) if row else _mock_cache.get(key)
    if saved:
        return {"advice": saved, "source": "ai"}

    items = advice.day_advice(report, body.child_id, body.lang)
    if not items:
        return {"advice": None, "source": "none"}
    if row:
        row.report = {**row.report, "advice": {**(row.report.get("advice") or {}), key: items}}
        flag_modified(row, "report")
        db.commit()
    else:
        _mock_cache[key] = items
    return {"advice": items, "source": "ai"}


class Question(BaseModel):
    question: str
    child_id: str | None = None
    session_id: str | None = None
    lang: str = "en"


@router.post("/insights/ask")
def ask(body: Question, db: DbSession = Depends(get_db)):
    if not body.question.strip():
        raise HTTPException(422, "Empty question")
    report, _ = _report(db, body.session_id)
    text = advice.answer(report, body.question.strip()[:500], body.child_id, body.lang)
    if text is None:
        return {"answer": None, "source": "none", "sources": []}
    return {"answer": text, "source": "ai", "sources": [report.get("date", "")]}
