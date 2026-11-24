"""Danger zones. Owner: P2.

A zone is {"id": "z1", "name": "Kitchen", "polygon": [[x, y], ...]} with normalized points (docs/api.md).
A person is {"track_id": 1, "box": [x1, y1, x2, y2], "keypoints": [[x, y, conf] * 17], ...} (COCO order).
"""

LEFT_ANKLE, RIGHT_ANKLE = 15, 16
MIN_ANKLE_CONF = 0.3


def _point_in_polygon(x: float, y: float, polygon: list) -> bool:
    """Ray casting. Points on an edge count as inside."""
    inside = False
    n = len(polygon)
    for i in range(n):
        x1, y1 = polygon[i][0], polygon[i][1]
        x2, y2 = polygon[(i + 1) % n][0], polygon[(i + 1) % n][1]
        # point exactly on this edge -> inside
        cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
        if abs(cross) < 1e-9 and min(x1, x2) - 1e-9 <= x <= max(x1, x2) + 1e-9 \
                and min(y1, y2) - 1e-9 <= y <= max(y1, y2) + 1e-9:
            return True
        if (y1 > y) != (y2 > y):
            x_cross = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < x_cross:
                inside = not inside
    return inside


def _feet_points(person: dict) -> list[tuple[float, float]]:
    """Ankle keypoints that are visible, else the bottom-middle of the box."""
    pts = []
    kps = person.get("keypoints") or []
    for idx in (LEFT_ANKLE, RIGHT_ANKLE):
        if idx < len(kps):
            x, y, conf = kps[idx][0], kps[idx][1], kps[idx][2] if len(kps[idx]) > 2 else 1.0
            if conf >= MIN_ANKLE_CONF:
                pts.append((x, y))
    if not pts:
        box = person.get("box")
        if box:
            pts.append(((box[0] + box[2]) / 2, box[3]))
    return pts


def in_zone(person: dict, zone: dict) -> bool:
    """True if the person's feet (ankle keypoints) are inside the zone polygon.

    Uses the visible ankles; if none is visible, the bottom-middle of the box.
    With two visible ankles, the midpoint between them is tested.
    """
    polygon = zone.get("polygon") or []
    if len(polygon) < 3:
        return False
    pts = _feet_points(person)
    if not pts:
        return False
    x = sum(p[0] for p in pts) / len(pts)
    y = sum(p[1] for p in pts) / len(pts)
    return _point_in_polygon(x, y, polygon)


class ZoneWatcher:
    """Turns per-frame in_zone results into ONE event per visit (frame by frame, no look-ahead).

    Call update() every frame for every tracked child. It returns an event dict when a visit that
    lasted at least `min_dwell_s` is over, or None. Call flush() when the video ends.
    """

    def __init__(self, min_dwell_s: float = 2.0, max_gap_s: float = 1.0, confidence: float = 0.9):
        self.min_dwell_s, self.max_gap_s, self.confidence = min_dwell_s, max_gap_s, confidence
        self._open: dict[tuple, dict] = {}   # (child_id, zone_id) -> {"start_s", "last_s"}
        self._counter = 0

    def _close(self, key, visit):
        if visit["last_s"] - visit["start_s"] < self.min_dwell_s:
            return None
        self._counter += 1
        return {"id": f"zone_e{self._counter}", "child_id": key[0], "type": "danger_zone",
                "start_s": visit["start_s"], "end_s": visit["last_s"],
                "confidence": self.confidence, "zone_id": key[1], "clip_url": None, "reviewed": False}

    def update(self, child_id: str, person: dict, zones: list[dict], t: float) -> list[dict]:
        events = []
        for zone in zones:
            key = (child_id, zone["id"])
            visit = self._open.get(key)
            if in_zone(person, zone):
                if visit and t - visit["last_s"] <= self.max_gap_s:
                    visit["last_s"] = t
                else:
                    if visit and (ev := self._close(key, visit)):
                        events.append(ev)
                    self._open[key] = {"start_s": t, "last_s": t}
            elif visit and t - visit["last_s"] > self.max_gap_s:
                if ev := self._close(key, visit):
                    events.append(ev)
                del self._open[key]
        return events

    def flush(self) -> list[dict]:
        events = [ev for key, v in self._open.items() if (ev := self._close(key, v))]
        self._open.clear()
        return events


# --- Danger signal: a dangerous object (knife, scissors...) close to the child's hands --------
DANGEROUS_LABELS = ("knife", "scissors")
LEFT_WRIST, RIGHT_WRIST = 9, 10


def dangerous_object_near(person: dict, objects: list[dict], labels=DANGEROUS_LABELS, margin: float = 0.05) -> "str | None":
    """Label of a dangerous object whose box (grown by `margin`) contains one of the child's wrists.

    `objects` is the "objects" list of a frame (docs/api.md): {"label", "box": [x1, y1, x2, y2]}.
    Returns the label, or None. A rule, not a model: it relies on P1's detector knowing the label.
    """
    kps = person.get("keypoints") or []
    wrists = [(kps[i][0], kps[i][1]) for i in (LEFT_WRIST, RIGHT_WRIST)
              if i < len(kps) and (kps[i][2] if len(kps[i]) > 2 else 1.0) >= MIN_ANKLE_CONF]
    for obj in objects or []:
        if obj.get("label") not in labels or not obj.get("box"):
            continue
        x1, y1, x2, y2 = obj["box"]
        if any(x1 - margin <= x <= x2 + margin and y1 - margin <= y <= y2 + margin for x, y in wrists):
            return obj["label"]
    return None
