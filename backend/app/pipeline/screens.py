"""Screen state per person. Owner: P1.

Inputs use the normalized boxes / keypoints from perception.py.
COCO keypoint order: 0 nose, 1 l_eye, 2 r_eye, 3 l_ear, 4 r_ear, 5 l_shoulder, 6 r_shoulder,
7 l_elbow, 8 r_elbow, 9 l_wrist, 10 r_wrist, 11 l_hip, 12 r_hip, 13 l_knee, 14 r_knee,
15 l_ankle, 16 r_ankle.
"""
from __future__ import annotations

import numpy as np

# ---------------------------------------------------------------------------
# Settings (tune here)
# ---------------------------------------------------------------------------
KP_CONF = 0.35                 # a keypoint counts as visible above this confidence
HANDHELD_LABELS = ("phone", "tablet")

# assign_devices: wrist-to-device distance, as a fraction of the person's box height
MAX_WRIST_DIST = 0.30
# no wrist visible: device centre inside the person's box still counts, with this distance
NO_WRIST_FALLBACK_DIST = 0.28

# tv_is_on: measured on the grayscale crop inside the TV box (0-255)
TV_INNER_MARGIN = 0.10         # ignore this fraction at each edge (bezel, frame)
TV_MIN_BRIGHTNESS = 45         # mean brightness of a lit picture
TV_MIN_CONTRAST = 22           # std of a real picture (an off TV is dark and flat)
TV_MIN_CHANGE = 6.0            # mean abs change vs previous frame (moving picture)
TV_CHANGE_MIN_BRIGHTNESS = 25  # change only counts if the screen is not black
TV_DARK_MAX = 30               # below this the TV is off whatever else happens
TV_PATCH = 32                  # crop is resized to TV_PATCH x TV_PATCH before comparing
TV_MEMORY_GRID = 0.05          # TV boxes are matched across frames on this grid

# head_direction
HEAD_DOWN_PITCH_EARS = 0.45    # (nose_y - ear_y) / face width above this -> looking down
HEAD_DOWN_PITCH_EYES = 0.60    # same, measured from the eyes when ears are not visible
HEAD_DOWN_NECK = 0.25          # (shoulder_y - nose_y) / shoulder width below this -> down
PROFILE_RATIO = 0.30           # nose offset from face centre / face width -> side profile
TV_SIDE_TOLERANCE = 0.05       # TV centre may be this far on the "wrong" side

_SCREEN_PRIORITY = {"none": 0, "phone": 1, "tablet": 1, "tv": 1, "multi_screen": 2}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _kp(keypoints, i):
    """(x, y) of keypoint i if visible, else None."""
    if not keypoints or i >= len(keypoints):
        return None
    x, y, c = keypoints[i][0], keypoints[i][1], (keypoints[i][2] if len(keypoints[i]) > 2 else 1.0)
    return (float(x), float(y)) if c is not None and c >= KP_CONF else None


def _center(box):
    return ((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0)


def _dist(a, b) -> float:
    return float(np.hypot(a[0] - b[0], a[1] - b[1]))


def _inside(pt, box) -> bool:
    return box[0] <= pt[0] <= box[2] and box[1] <= pt[1] <= box[3]


def _face_width(keypoints) -> float | None:
    le, re = _kp(keypoints, 3), _kp(keypoints, 4)
    if le and re and _dist(le, re) > 1e-4:
        return _dist(le, re)
    ley, rey = _kp(keypoints, 1), _kp(keypoints, 2)
    if ley and rey and _dist(ley, rey) > 1e-4:
        return _dist(ley, rey) * 2.0
    ls, rs = _kp(keypoints, 5), _kp(keypoints, 6)
    if ls and rs and _dist(ls, rs) > 1e-4:
        return _dist(ls, rs) * 0.5
    return None


def facing_side(keypoints) -> str:
    """Rough yaw: 'front' (faces camera), 'left' / 'right' (profile, image direction), 'away', 'unknown'."""
    nose = _kp(keypoints, 0)
    eyes = [p for p in (_kp(keypoints, 1), _kp(keypoints, 2)) if p]
    ears = [p for p in (_kp(keypoints, 3), _kp(keypoints, 4)) if p]
    if not nose and not eyes:
        return "away" if (ears or _kp(keypoints, 5) or _kp(keypoints, 6)) else "unknown"
    if not nose:
        return "front"
    ref = ears if len(ears) == 2 else (eyes if len(eyes) == 2 else None)
    width = _face_width(keypoints)
    if ref and width:
        cx = (ref[0][0] + ref[1][0]) / 2.0
        off = (nose[0] - cx) / width
        if off <= -PROFILE_RATIO:
            return "left"
        if off >= PROFILE_RATIO:
            return "right"
        return "front"
    # only one ear visible: the nose points away from it
    if len(ears) == 1:
        return "left" if nose[0] < ears[0][0] else "right"
    return "front"


def _tv_in_front(person: dict, tv: dict) -> bool:
    """True if the TV is on the side the head is turned to (front/away = can't tell = yes)."""
    side = facing_side(person.get("keypoints"))
    if side in ("front", "away", "unknown"):
        return True
    head = _kp(person.get("keypoints"), 0) or _center(person["box"])
    tv_x = _center(tv["box"])[0]
    if side == "left":
        return tv_x <= head[0] + TV_SIDE_TOLERANCE
    return tv_x >= head[0] - TV_SIDE_TOLERANCE


# Last TV crop per TV position, to measure change between frames.
_tv_memory: dict = {}


def reset_tv_memory() -> None:
    _tv_memory.clear()


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------
def assign_devices(people: list[dict], objects: list[dict]) -> dict:
    """Give each phone/tablet to the person whose wrist is closest -> {track_id: [objects]}.

    Every person gets a key (empty list if they hold nothing). A device further than
    MAX_WRIST_DIST (in person heights) from every wrist is not held by anyone.
    """
    held: dict = {p["track_id"]: [] for p in people}
    for obj in objects:
        if obj.get("label") not in HANDHELD_LABELS:
            continue
        oc = _center(obj["box"])
        best_tid, best_d = None, None
        for p in people:
            box = p["box"]
            height = max(box[3] - box[1], 1e-3)
            wrists = [w for w in (_kp(p.get("keypoints"), 9), _kp(p.get("keypoints"), 10)) if w]
            if wrists:
                d = min(_dist(w, oc) for w in wrists) / height
            elif _inside(oc, box):
                d = NO_WRIST_FALLBACK_DIST
            else:
                continue
            if d <= MAX_WRIST_DIST and (best_d is None or d < best_d):
                best_tid, best_d = p["track_id"], d
        if best_tid is not None:
            held[best_tid].append(obj)
    return held


def tv_is_on(frame, tv_box) -> bool:
    """Brightness + change inside the TV box."""
    if frame is None or tv_box is None:
        return False
    import cv2

    h, w = frame.shape[:2]
    x1, y1, x2, y2 = tv_box
    mx, my = (x2 - x1) * TV_INNER_MARGIN, (y2 - y1) * TV_INNER_MARGIN
    px1, py1 = int(max(0, (x1 + mx) * w)), int(max(0, (y1 + my) * h))
    px2, py2 = int(min(w, (x2 - mx) * w)), int(min(h, (y2 - my) * h))
    if px2 - px1 < 4 or py2 - py1 < 4:
        return False

    crop = frame[py1:py2, px1:px2]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    patch = cv2.resize(gray, (TV_PATCH, TV_PATCH), interpolation=cv2.INTER_AREA).astype(np.float32)
    brightness = float(patch.mean())
    contrast = float(patch.std())

    key = tuple(round(v / TV_MEMORY_GRID) for v in tv_box)
    prev = _tv_memory.get(key)
    _tv_memory[key] = patch
    change = float(np.abs(patch - prev).mean()) if prev is not None else 0.0

    if brightness < TV_DARK_MAX:
        return False
    if brightness >= TV_MIN_BRIGHTNESS and contrast >= TV_MIN_CONTRAST:
        return True
    return change >= TV_MIN_CHANGE and brightness >= TV_CHANGE_MIN_BRIGHTNESS


def head_direction(keypoints) -> str:
    """'toward_tv', 'down' or 'other', from nose, eyes and ears.

    'down'      head tilted down (looking at hands / lap: phone, tablet)
    'toward_tv' head level, so the person can be watching something in front of them
                (screen_state also checks the TV is on the side the head is turned to)
    'other'     no head keypoints visible
    """
    nose = _kp(keypoints, 0)
    eyes = [p for p in (_kp(keypoints, 1), _kp(keypoints, 2)) if p]
    ears = [p for p in (_kp(keypoints, 3), _kp(keypoints, 4)) if p]
    if not nose and not eyes and not ears:
        return "other"
    if not nose:
        # back of the head / face hidden: can't see a downward tilt, treat as level
        return "toward_tv"

    width = _face_width(keypoints)
    if width:
        if ears:
            pitch = (nose[1] - np.mean([e[1] for e in ears])) / width
            if pitch >= HEAD_DOWN_PITCH_EARS:
                return "down"
        elif eyes:
            pitch = (nose[1] - np.mean([e[1] for e in eyes])) / width
            if pitch >= HEAD_DOWN_PITCH_EYES:
                return "down"

    ls, rs = _kp(keypoints, 5), _kp(keypoints, 6)
    if ls and rs:
        sw = _dist(ls, rs)
        if sw > 1e-3 and ((ls[1] + rs[1]) / 2.0 - nose[1]) / sw < HEAD_DOWN_NECK:
            return "down"
    return "toward_tv"


def screen_state(person: dict, devices: list[dict], tv: dict | None) -> str:
    """'tv', 'tablet', 'phone', 'multi_screen' or 'none'.

    person:  one entry of detect_people()
    devices: the objects assign_devices() gave to this person
    tv:      a TV object {"label": "tv", "box", "on"} or None
    """
    labels = {d.get("label") for d in (devices or [])}
    has_tablet, has_phone = "tablet" in labels, "phone" in labels
    head = head_direction(person.get("keypoints"))

    tv_usable = bool(tv) and bool(tv.get("on")) and head != "other" and _tv_in_front(person, tv)

    if has_tablet and has_phone:
        return "multi_screen"
    if has_tablet or has_phone:
        # device in hand while a TV is on in front of them = more than one screen at once
        if tv_usable:
            return "multi_screen"
        return "tablet" if has_tablet else "phone"
    if tv_usable and head == "toward_tv":
        return "tv"
    return "none"


def best_screen_state(person: dict, devices: list[dict], tvs: list[dict]) -> str:
    """screen_state over several TVs: the strongest result wins."""
    best = screen_state(person, devices, None)
    for tv in tvs or []:
        s = screen_state(person, devices, tv)
        if _SCREEN_PRIORITY[s] > _SCREEN_PRIORITY[best]:
            best = s
    return best
