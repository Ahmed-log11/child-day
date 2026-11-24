"""Loads the demo household: children, the pre-analyzed demo video and generated history.

Run with: python -m app.seed   Owner: P4.
Generated days must be saved with is_demo_data=True.
"""
import random
from datetime import date, datetime, timedelta, timezone

from app.db.models import Child, Event, Segment, Session, Zone
from app.db.session import Base, SessionLocal
from app.db.models import new_id
from app.pipeline.report import build_report

DAYS = 21                      # about 3 weeks of history
DAY_START_H = 7                # each generated day covers 7:00 to 21:00
DAY_LENGTH_S = 14 * 3600
RIYADH = timezone(timedelta(hours=3))
WEEKEND = (4, 5)               # Friday and Saturday

HOUSEHOLD = [
    {"name": "Sara", "age_group": "5-12", "color": "#7B5CC6", "screen_bias": 1.2},
    {"name": "Omar", "age_group": "5-12", "color": "#2A9D8F", "screen_bias": 0.8},
]

# Chance of each screen state by part of the day
SCREEN_ODDS = {
    "morning":   {"none": 0.88, "tv": 0.07, "tablet": 0.03, "phone": 0.02, "multi_screen": 0.00},
    "afternoon": {"none": 0.75, "tv": 0.10, "tablet": 0.11, "phone": 0.02, "multi_screen": 0.02},
    "evening":   {"none": 0.45, "tv": 0.33, "tablet": 0.12, "phone": 0.02, "multi_screen": 0.08},
}
# Chance of each activity state by part of the day
ACTIVITY_ODDS = {
    "morning":   {"active": 0.35, "light": 0.40, "still": 0.25},
    "afternoon": {"active": 0.25, "light": 0.40, "still": 0.35},
    "evening":   {"active": 0.10, "light": 0.30, "still": 0.60},
}


def _part_of_day(t: float) -> str:
    # Morning / afternoon / evening from seconds since 7:00
    hour = DAY_START_H + t / 3600
    return "morning" if hour < 12 else "afternoon" if hour < 18 else "evening"


def _pick(rng, odds: dict, boost: float) -> str:
    # Picks a state; boost > 1 makes screens more likely (weekends, Sara)
    states = list(odds)
    weights = [odds[s] if s == "none" else odds[s] * boost for s in states]
    return rng.choices(states, weights)[0]


def _timeline(rng, child_id: str, category: str, odds_table: dict, boost: float) -> list[dict]:
    # One full day of non-overlapping segments for one category, in 5-30 minute blocks
    segments, t = [], 0
    while t < DAY_LENGTH_S:
        end = min(t + rng.randint(5, 30) * 60, DAY_LENGTH_S)
        state = _pick(rng, odds_table[_part_of_day(t)], boost)
        if segments and segments[-1]["state"] == state:
            segments[-1]["end_s"] = end
        else:
            segments.append({"child_id": child_id, "category": category, "state": state,
                             "start_s": t, "end_s": end})
        t = end
    return segments


def _events(rng, children: list[dict], zone_id, days_ago: int) -> list[dict]:
    # 0 to 2 alerts a day; older ones are already reviewed
    events = []
    for _ in range(rng.choice([0, 0, 1, 1, 2])):
        child = rng.choice(children)
        etype = "danger_zone" if zone_id and rng.random() < 0.7 else "fall"
        start = rng.randint(0, DAY_LENGTH_S - 200)
        events.append({
            "id": new_id("e"), "child_id": child["id"], "type": etype,
            "start_s": start, "end_s": start + rng.randint(5, 120),
            "confidence": round(rng.uniform(0.6, 0.95), 2),
            "zone_id": zone_id if etype == "danger_zone" else None,
            "clip_url": None, "reviewed": days_ago > 2,
        })
    return events


def _get_or_create_children(db) -> list[dict]:
    # Sara and Omar, created only if they don't exist yet
    out = []
    for h in HOUSEHOLD:
        child = db.query(Child).filter_by(name=h["name"]).first()
        if not child:
            child = Child(name=h["name"], age_group=h["age_group"], color=h["color"])
            db.add(child)
            db.flush()
        out.append({"id": child.id, "name": child.name, "age_group": child.age_group, "track_ids": []})
    return out


def _clear_demo(db) -> None:
    # Removes earlier demo data, so running the seed twice doesn't duplicate days
    ids = [s.id for s in db.query(Session).filter_by(is_demo_data=True)]
    if ids:
        db.query(Segment).filter(Segment.session_id.in_(ids)).delete(synchronize_session=False)
        db.query(Event).filter(Event.session_id.in_(ids)).delete(synchronize_session=False)
        db.query(Session).filter(Session.id.in_(ids)).delete(synchronize_session=False)


def seed() -> None:
    db = SessionLocal()
    Base.metadata.create_all(bind=db.get_bind())
    try:
        children = _get_or_create_children(db)
        _clear_demo(db)
        zone = db.query(Zone).first()
        rng = random.Random(7)  # same "random" days every time
        today = date.today()

        for days_ago in range(1, DAYS + 1):
            day = today - timedelta(days=days_ago)
            weekend = 1.4 if day.weekday() in WEEKEND else 1.0

            # Presence, screen and activity timelines for each child
            segments = []
            for child, h in zip(children, HOUSEHOLD):
                segments.append({"child_id": child["id"], "category": "presence", "state": "present",
                                 "start_s": 0, "end_s": DAY_LENGTH_S})
                segments += _timeline(rng, child["id"], "screen", SCREEN_ODDS, weekend * h["screen_bias"])
                segments += _timeline(rng, child["id"], "activity", ACTIVITY_ODDS, 1.0)
            events = _events(rng, children, zone.id if zone else None, days_ago)

            # One demo session per day, with the report built by build_report
            session = Session(date=day, source="upload", duration_s=DAY_LENGTH_S, is_demo_data=True)
            db.add(session)
            db.flush()
            started = datetime(day.year, day.month, day.day, DAY_START_H, tzinfo=RIYADH)
            info = {"id": session.id, "date": day.isoformat(), "started_at": started.isoformat(),
                    "video": {"url": None, "duration_s": DAY_LENGTH_S, "width": 1920,
                              "height": 1080, "analyzed_fps": 3}}
            session.report = build_report(info, children, segments, events)

            # Segments and events in their own tables too (the dashboard reads these)
            for s in segments:
                db.add(Segment(session_id=session.id, **s))
            for e in events:
                db.add(Event(session_id=session.id, **e))

        db.commit()
        print(f"Seeded {DAYS} demo days for {', '.join(c['name'] for c in children)}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()