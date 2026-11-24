"""Builds the 'Session report' JSON (docs/api.md). Owner: P4."""
from collections import Counter

SCREEN_STATES = ["tv", "tablet", "phone", "multi_screen", "none"]
ACTIVITY_STATES = ["active", "light", "still"]
ROUND_T = 2


def _duration(seg: dict) -> float:
    # Length of one segment in seconds
    return seg["end_s"] - seg["start_s"]


def _during(child_segments: list[dict], still: dict) -> str:
    # The screen state that covered most of a still period
    overlap = Counter()
    for seg in child_segments:
        if seg["category"] == "screen":
            o = min(seg["end_s"], still["end_s"]) - max(seg["start_s"], still["start_s"])
            if o > 0:
                overlap[seg["state"]] += o
    return overlap.most_common(1)[0][0] if overlap else "none"


def _child_totals(child_segments: list[dict]) -> dict:
    # Sum the seconds per state for one child.
    # multi_screen is its own state, so it is never also counted in tv_s or tablet_s.
    totals = {f"{s}_s": 0.0 for s in SCREEN_STATES + ACTIVITY_STATES}
    totals["present_s"] = 0.0

    for seg in child_segments:
        d = _duration(seg)
        if seg["category"] in ("screen", "activity"):
            key = f"{seg['state']}_s"
            if key in totals:  # ignores unknown states instead of crashing
                totals[key] += d
        elif seg["category"] == "presence" and seg["state"] == "present":
            totals["present_s"] += d

    totals = {k: round(v, ROUND_T) for k, v in totals.items()}

    # Longest still period and what the child was mostly watching during it
    stills = [s for s in child_segments
              if s["category"] == "activity" and s["state"] == "still"]
    if stills:
        best = max(stills, key=_duration)
        totals["longest_still"] = {
            "duration_s": round(_duration(best), ROUND_T),
            "start_s": best["start_s"],
            "during": _during(child_segments, best),
        }
    else:
        totals["longest_still"] = None

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