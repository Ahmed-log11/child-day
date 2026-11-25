"""Advice and answers written by Claude from a day's report.

Only numbers leave the server: minutes on each screen, minutes moving, the moments and their
times. No video, no frames, no faces. Without ANTHROPIC_API_KEY (or when the call fails) the
functions return None, and the frontend shows its own rule-based advice instead.
"""
import json
import logging

from app.config import settings

log = logging.getLogger(__name__)

ACTIONS = ("export", "specialist", "review", "none")
LANGS = {"en": "English", "ar": "Arabic (simple Modern Standard Arabic, friendly)"}

SYSTEM = """You are Kanaf's advisor. Kanaf turns a home camera into a calm summary of a child's day
(screen time, movement, eating and drinking, and a few safety moments) for parents.

Rules:
- Write for a busy parent: warm, plain words, short. No lectures, no blame, no emojis.
- Base every point on the numbers given. Mention the real numbers.
- The video may be short (a recorded part of the day, not the full day). Talk about "this recording"
  or "the recorded time" when it is short, and do not compare it to daily limits as if it were a full day.
- Common guidance you may use: about 60 minutes of active play a day for children 5 to 17;
  for ages 2 to 5, no more than about 1 hour of screens a day; using two screens at once and
  long still stretches are worth breaking up.
- Never diagnose. Safety moments are flags for the parent to check, not verdicts.
- Suggest a specialist (pediatrician, physiotherapist, child psychologist or similar, whichever fits)
  only when the data gives a reason, like a fall where the child stayed down, repeated rough play,
  or a pattern a parent may want a professional to look at. Phrase it as an option.
- Each advice item can carry one action:
  "review" = look at the flagged moments, "export" = export the report to keep or share,
  "specialist" = export the report to share with a specialist, "none" = no button."""


def _client():
    if not settings.anthropic_api_key:
        return None
    try:
        import anthropic
    except ImportError:
        log.warning("The anthropic package is not installed; AI advice is off")
        return None
    return anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=25.0)


def _ask_claude(system: str, prompt: str, max_tokens: int) -> str | None:
    client = _client()
    if client is None:
        return None
    try:
        msg = client.messages.create(
            model=settings.insights_model, max_tokens=max_tokens, system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(getattr(b, "text", "") for b in msg.content).strip()
    except Exception:
        log.exception("Claude call failed")
        return None


def _min(seconds) -> float:
    return round((seconds or 0) / 60, 1)


def day_facts(report: dict, child_id: str) -> dict:
    """The numbers Claude sees for one child (minutes, rounded). Nothing else leaves the server."""
    child = next((c for c in report["children"] if c["id"] == child_id), None)
    if child is None:
        raise KeyError(child_id)
    tot = report["totals"].get(child_id, {})
    intake = {"eating": 0.0, "drinking": 0.0}
    for s in report.get("segments", []):
        if s["child_id"] == child_id and s["category"] == "intake" and s["state"] in intake:
            intake[s["state"]] += s["end_s"] - s["start_s"]
    screen = sum(tot.get(k, 0) for k in ("tv_s", "tablet_s", "phone_s", "multi_screen_s"))
    longest = tot.get("longest_still") or {}
    return {
        "child": {"name": child["name"], "age_group": child.get("age_group")},
        "recorded_minutes": _min(report["video"]["duration_s"]),
        "seen_minutes": _min(tot.get("present_s")),
        "screens_minutes": {"total": _min(screen), "tv": _min(tot.get("tv_s")), "tablet": _min(tot.get("tablet_s")),
                            "phone": _min(tot.get("phone_s")), "two_at_once": _min(tot.get("multi_screen_s"))},
        "movement_minutes": {"active": _min(tot.get("active_s")), "light": _min(tot.get("light_s")),
                             "still": _min(tot.get("still_s"))},
        "longest_still_minutes": _min(longest.get("duration_s")),
        "eating_minutes": _min(intake["eating"]),
        "drinking_minutes": _min(intake["drinking"]),
        "moments": [
            {"type": e["type"], "at_minute": _min(e["start_s"]), "length_seconds": round(e["end_s"] - e["start_s"]),
             "reviewed_by_parent": bool(e.get("reviewed"))}
            for e in report["events"] if e["child_id"] == child_id
        ],
    }


def _parse_items(text: str) -> list[dict] | None:
    try:
        start, end = text.index("["), text.rindex("]") + 1
        items = json.loads(text[start:end])
    except ValueError:
        return None
    out = []
    for it in items[:3]:
        if not isinstance(it, dict) or not it.get("text"):
            continue
        action = it.get("action") if it.get("action") in ACTIONS else "none"
        out.append({"title": str(it.get("title", ""))[:80], "text": str(it["text"])[:400], "action": action})
    return out or None


def day_advice(report: dict, child_id: str, lang: str = "en") -> list[dict] | None:
    facts = day_facts(report, child_id)
    prompt = (
        f"Here is {facts['child']['name']}'s day as numbers (JSON):\n{json.dumps(facts, ensure_ascii=False)}\n\n"
        f"Write 2 or 3 advice items in {LANGS.get(lang, 'English')}. "
        "Reply with JSON only: a list of objects with keys \"title\" (max 6 words), "
        "\"text\" (1 or 2 short sentences) and \"action\" (review, export, specialist or none). "
        "Use \"review\" when there are moments not reviewed yet. Use \"export\" or \"specialist\" at most once."
    )
    text = _ask_claude(SYSTEM, prompt, 600)
    return _parse_items(text) if text else None


def answer(report: dict, question: str, child_id: str | None, lang: str = "en") -> str | None:
    ids = [child_id] if child_id else [c["id"] for c in report["children"]]
    facts = [day_facts(report, cid) for cid in ids if cid in report["totals"]]
    prompt = (
        f"The latest analyzed day ({report.get('date')}), per child (JSON):\n{json.dumps(facts, ensure_ascii=False)}\n\n"
        f"The parent asks: {question}\n\n"
        f"Answer in {LANGS.get(lang, 'English')} in 2 to 4 short sentences, from these numbers only. "
        "If the numbers cannot answer it, say so kindly and say what Kanaf does track. Plain text, no lists."
    )
    return _ask_claude(SYSTEM, prompt, 400)
