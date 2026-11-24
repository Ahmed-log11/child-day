"""Builds the 'Session report' JSON (docs/api.md). Owner: P4."""

SCREEN_STATES = ["tv", "tablet", "phone", "multi_screen", "none"]
ACTIVITY_STATES = ["active", "light", "still"]


def _duration(seg: dict) -> float:
    # Length of one segment in seconds
    return seg["end_s"] - seg["start_s"]


def _screen_at(child_segments: list[dict], t: float) -> str:
    # Which screen the child was on at time t ("none" if no screen segment covers t)
    for seg in child_segments:
        if seg["category"] == "screen" and seg["start_s"] <= t < seg["end_s"]:
            return seg["state"]
    return "none"


def _child_totals(child_segments: list[dict]) -> dict:
    # Sum the seconds per state (tv, tablet, still...) for one child.
    # multi_screen is its own state, so it is never also counted in tv_s or tablet_s.
    totals = {f"{s}_s": 0 for s in SCREEN_STATES + ACTIVITY_STATES}
    totals["present_s"] = 0

    for seg in child_segments:
        d = _duration(seg)
        if seg["category"] in ("screen", "activity"):
            totals[f"{seg['state']}_s"] += d
        elif seg["category"] == "presence" and seg["state"] == "present":
            totals["present_s"] += d

    # Longest still period, and what the child was watching when it started
    still = [s for s in child_segments
             if s["category"] == "activity" and s["state"] == "still"]
    if still:
        best = max(still, key=_duration)
        totals["longest_still"] = {
            "duration_s": _duration(best),
            "start_s": best["start_s"],
            "during": _screen_at(child_segments, best["start_s"]),
        }
    else:
        totals["longest_still"] = {"duration_s": 0, "start_s": None, "during": None}

    return totals


def build_report(session: dict, children: list[dict], segments: list[dict], events: list[dict]) -> dict:
    """Computes totals and longest still period, returns the report in the contract format."""
    # Totals for each child
    totals = {}
    for child in children:
        mine = [s for s in segments if s["child_id"] == child["id"]]
        totals[child["id"]] = _child_totals(mine)

    # Assemble the final report in the api.md format
    return {
        "id": session.get("id"),
        "date": session.get("date"),
        "started_at": session.get("started_at"),
        "video": session.get("video"),
        "children": children,
        "segments": segments,
        "totals": totals,
        "events": events,
    }