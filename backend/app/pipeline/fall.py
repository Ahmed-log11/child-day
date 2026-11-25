"""Fall detection with rules on keypoints. Owner: P2.

`history` = the recent frames of ONE child, oldest first, about 4-6 seconds (12-18 frames at 3 fps).
It must follow the CHILD, not the tracker id: the tracker often loses a falling person for a frame or
two and gives them a new id, so a per-track history starts already on the floor and the fall is missed.
When a new track is linked to a child, its frames belong to that child's history from its first frame.
Each entry:
    {"t": 12.33, "box": [x1, y1, x2, y2], "keypoints": [[x, y, conf] * 17], "aspect": 1.78}
`aspect` (video width / height) is optional; without it the torso angle is slightly distorted
on non-square videos. Coordinates are normalized 0-1, y grows downward (COCO keypoint order).
"""
import math

L_SHOULDER, R_SHOULDER, L_HIP, R_HIP = 5, 6, 11, 12

MIN_KP_CONF = 0.3
MIN_USABLE_FRAMES = 5
UPRIGHT_ANGLE = 40.0       # torso within 40 degrees of vertical = upright
DOWN_ANGLE = 60.0          # torso more than 60 degrees from vertical = horizontal
MIN_HIP_DROP = 0.10        # without a box: hips must move down by at least 10% of the frame height
MIN_HIP_DROP_BODY = 0.15   # with a box: hips must move down by at least 15% of the person's standing height
                           # (a small child far from the camera drops less than 10% of the frame)
MAX_FALL_S = 1.5           # upright -> down must happen within this time (slower = lying down on purpose)
MIN_DOWN_S = 2.0           # and the body stays down at least this long


def _mid(kps, a, b):
    pts = [kps[i] for i in (a, b) if i < len(kps) and (kps[i][2] if len(kps[i]) > 2 else 1.0) >= MIN_KP_CONF]
    if not pts:
        return None
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


def _pose(frame: dict):
    """(t, hip_y, torso_angle_deg from vertical, box_height or None), or None if shoulders/hips are not visible."""
    kps = frame.get("keypoints") or []
    sh, hp = _mid(kps, L_SHOULDER, R_SHOULDER), _mid(kps, L_HIP, R_HIP)
    if sh is None or hp is None:
        return None
    aspect = frame.get("aspect") or 1.0
    dx, dy = abs(sh[0] - hp[0]) * aspect, abs(sh[1] - hp[1])
    angle = math.degrees(math.atan2(dx, dy)) if (dx or dy) else 0.0
    box = frame.get("box")
    height = (box[3] - box[1]) if box and len(box) == 4 and box[3] > box[1] else None
    return frame["t"], hp[1], angle, height


def _find_fall(history: list[dict]):
    """(t_up, t_down) of a fall in this window, or None. See detect_fall."""
    poses = [p for p in (_pose(f) for f in history) if p is not None]
    if len(poses) < MIN_USABLE_FRAMES:
        return None

    # Find the last upright moment that is followed only by "down" frames until the end.
    down_start = None
    for i in range(len(poses) - 1, -1, -1):
        if poses[i][2] >= DOWN_ANGLE:
            down_start = i
        else:
            break
    if down_start is None or down_start == 0:
        return None    # not down at the end, or down for the whole window (no visible fall)

    # Last upright frame before the body went down.
    up_idx = None
    for i in range(down_start - 1, -1, -1):
        if poses[i][2] <= UPRIGHT_ANGLE:
            up_idx = i
            break
    if up_idx is None:
        return None    # slid from "leaning" to down: not a clear upright start

    t_up, hip_up, _, height_up = poses[up_idx]
    t_down = poses[down_start][0]
    down_frames = poses[down_start:]
    stay_s = down_frames[-1][0] - t_down

    fast = (t_down - t_up) <= MAX_FALL_S
    drop = (sum(p[1] for p in down_frames) / len(down_frames)) - hip_up
    # Relative to the standing body when we know its size, so far-away children are not missed.
    dropped = drop >= (MIN_HIP_DROP_BODY * height_up if height_up else MIN_HIP_DROP)
    stays = stay_s >= MIN_DOWN_S
    return (t_up, t_down) if (fast and dropped and stays) else None


def detect_fall(history: list[dict]) -> bool:
    """Fast drop of the hips + body becomes horizontal + stays down for a few seconds."""
    return _find_fall(history) is not None


# --- Danger signal: child lying still after a fall (possible injury) -------------------------
STILL_MAX_MOVE = 0.02      # hips move less than 2% of the frame during the window
STILL_MIN_S = 10.0         # horizontal and still for at least this long


def lying_still(history: list[dict], min_s: float = STILL_MIN_S) -> bool:
    """True if the body has been horizontal AND almost motionless for `min_s` seconds.

    Use it after a `fall` event: it raises that event's priority to "high" (a child who does not
    get up may be hurt). `history` needs at least `min_s` seconds, so keep a longer buffer for this.
    """
    poses = [p for p in (_pose(f) for f in history) if p is not None]
    if len(poses) < MIN_USABLE_FRAMES or poses[-1][0] - poses[0][0] < min_s:
        return False
    if any(p[2] < DOWN_ANGLE for p in poses):
        return False
    hips = [p[1] for p in poses]
    return (max(hips) - min(hips)) <= STILL_MAX_MOVE


# --- One event per fall ----------------------------------------------------------------------
FALL_CONFIDENCE = 0.85     # rule-based: fixed confidence


class FallWatcher:
    """Turns per-frame detect_fall results into ONE fall event per fall.

    detect_fall stays True for every frame while the child is still down, so without this one
    fall would give many events. Call update() every frame for every tracked child with that
    child's history (oldest first; keep >= 10 s if you want the lying-still check).

    The event is returned as soon as the fall is confirmed (good for live alerts). The next fall
    of the same child can only fire after the child has been seen upright again.
    Priority ("normal", or "high" if the child then lies still) is kept in self.priority[event_id].
    """

    def __init__(self, confidence: float = FALL_CONFIDENCE):
        self.confidence = confidence
        self._down: dict = {}      # child_id -> event_id of the fall the child has not got up from
        self._counter = 0
        self.priority: dict = {}

    def update(self, child_id: str, history: list[dict], t: float) -> list:
        poses = [p for p in (_pose(f) for f in history) if p is not None]
        if child_id in self._down:
            if poses and poses[-1][2] <= UPRIGHT_ANGLE:
                del self._down[child_id]                      # got up: the next fall is a new event
            elif lying_still(history):
                self.priority[self._down[child_id]] = "high"  # did not get up: possible injury
            return []
        found = _find_fall(history)
        if found is None:
            return []
        t_up, _ = found
        self._counter += 1
        eid = f"fall_e{self._counter}"
        self._down[child_id] = eid
        self.priority[eid] = "normal"
        return [{"id": eid, "child_id": child_id, "type": "fall", "start_s": t_up, "end_s": t,
                 "confidence": self.confidence, "zone_id": None, "clip_url": None, "reviewed": False}]
