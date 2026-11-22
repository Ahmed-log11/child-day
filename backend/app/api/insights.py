"""AI insights (stretch goal). Returns a fixed answer for now."""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["insights"])


class Question(BaseModel):
    question: str
    child_id: str | None = None


@router.post("/insights/ask")
def ask(body: Question):
    return {"answer": "Insights are not connected yet.", "sources": []}
