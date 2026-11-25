"""Movement per person. Owner: P1.

movement_score() measures how far the keypoints moved between two frames, divided by
body size, so a child close to the camera and one far away score the same.

activity_state() expects movement PER SECOND (movement_score / seconds between the two
frames). The Engine does this division and averages over ~2 s, so the cut-offs below
do not depend on the analyzed fps.

Eating and drinking (IntakeWatcher, bottom of this file) are a separate state, "intake":
'eating', 'drinking' or 'none'. They are kept apart from active/light/still because the
contract fixes the activity enum and a child can eat while sitting still.
"""
from __future__ import annotations

from collections import deque

import numpy as np

# ---------------------------------------------------------------------------
# Settings (tune here)
# ---------------------------------------------------------------------------
KP_CONF = 0.35          # keypoints below this confidence are ignored
MIN_KEYPOINTS = 4       # fewer matching keypoints than this -> score 0
MAX_SCORE = 2.0         # cap per frame pair (ID switches / glitches give huge jumps)

# body sizes per second
ACTIVE_MIN = 0.25       # walking, running, jumping, dancing
LIGHT_MIN = 0.06        # fidgeting, playing with hands, shifting position
# below LIGHT_MIN -> still (sitting / lying while watching)


def movement_score(prev_keypoints, keypoints, box) -> float:
    """Keypoint motion between two frames, normalized by body size."""
    if not prev_keypoints or not keypoints or box is None:
        return 0.0
    prev = np.asarray(prev_keypoints, dtype=float)
    cur = np.asarray(keypoints, dtype=float)
    if prev.shape != cur.shape or prev.ndim != 2 or prev.shape[1] < 2:
        return 0.0

    if prev.shape[1] >= 3:
        mask = (prev[:, 2] >= KP_CONF) & (cur[:, 2] >= KP_CONF)
    else:
        mask = np.ones(len(cur), dtype=bool)
    if int(mask.sum()) < MIN_KEYPOINTS:
        return 0.0

    body = max(box[2] - box[0], box[3] - box[1])   # height standing, width lying down
    if body <= 1e-3:
        return 0.0

    disp = np.hypot(cur[mask, 0] - prev[mask, 0], cur[mask, 1] - prev[mask, 1])
    return float(min(disp.mean() / body, MAX_SCORE))


def activity_state(score: float) -> str:
    """'active', 'light' or 'still' (score = body sizes moved per second)."""
    if score is None:
        return "still"
    if score >= ACTIVE_MIN:
        return "active"
    if score >= LIGHT_MIN:
        return "light"
    return "still"


# ===========================================================================
# Eating and drinking ("intake")
# ===========================================================================
# Objects come from perception.detect_objects (normalized boxes).
EATING_LABELS = ("food", "utensil", "bowl")
DRINK_LABELS = ("cup", "bottle")
INTAKE_STATES = ("eating", "drinking", "none")

# Distances are in "body scales" (about one shoulder width), so they work near and far.
HAND_MOUTH_NEAR = 0.8       # wrist this close to the mouth -> hand is at the mouth
HAND_MOUTH_AWAY = 1.2       # and must move further than this to count as away again
OBJECT_AT_HAND = 0.9        # a cup / utensil this close to a wrist is in the hand
OBJECT_AT_MOUTH = 0.9       # a cup this close to the mouth is being drunk from
FOOD_NEAR = 1.8             # food / bowl this close to the mouth or a hand is the child's food

# Eating: repeated hand-to-mouth movements while food is near
EAT_WINDOW_S = 20.0         # look for bites in the last N seconds
EAT_MIN_BITES = 2           # at least this many hand-to-mouth movements in the window
FOOD_MEMORY_S = 20.0        # food seen this recently still counts (hands often hide it)

# Drinking: a cup or bottle held at the mouth
DRINK_MIN_S = 0.6           # at the mouth this long (about 2 frames at 3 fps)
DRINK_HOLD_S = 2.0          # keep 'drinking' this long after the cup leaves the mouth
DRINK_MEMORY_S = 3.0        # a cup seen in the hand this recently still counts (detected every 2nd frame)


def _visible(keypoints, i):
    if not keypoints or i >= len(keypoints):
        return None
    kp = keypoints[i]
    c = kp[2] if len(kp) > 2 else 1.0
    return (float(kp[0]), float(kp[1])) if c is not None and c >= KP_CONF else None


def _dist(a, b) -> float:
    return float(np.hypot(a[0] - b[0], a[1] - b[1]))


def _center(box):
    return ((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0)


def mouth_point(keypoints):
    """Rough mouth position: a little below the nose (or below the eyes / ears)."""
    nose = _visible(keypoints, 0)
    eyes = [p for p in (_visible(keypoints, 1), _visible(keypoints, 2)) if p]
    if nose:
        drop = abs(nose[1] - np.mean([e[1] for e in eyes])) * 0.8 if eyes else 0.0
        return (nose[0], nose[1] + drop)
    ears = [p for p in (_visible(keypoints, 3), _visible(keypoints, 4)) if p]
    head = eyes or ears
    if head:
        return (float(np.mean([p[0] for p in head])), float(np.mean([p[1] for p in head])))
    return None


def body_scale(keypoints, box) -> float:
    """About one shoulder width, robust when the child is turned sideways."""
    candidates = []
    ls, rs = _visible(keypoints, 5), _visible(keypoints, 6)
    if ls and rs:
        candidates.append(_dist(ls, rs))
    le, re = _visible(keypoints, 3), _visible(keypoints, 4)
    if le and re:
        candidates.append(_dist(le, re) * 2.0)
    if box is not None:
        candidates.append(max(box[3] - box[1], box[2] - box[0]) * 0.18)
    return max(max(candidates) if candidates else 0.0, 1e-3)


def hand_to_mouth(keypoints, box) -> float | None:
    """Distance from the closest visible wrist to the mouth, in body scales (None = can't tell)."""
    mouth = mouth_point(keypoints)
    wrists = [w for w in (_visible(keypoints, 9), _visible(keypoints, 10)) if w]
    if mouth is None or not wrists:
        return None
    return min(_dist(w, mouth) for w in wrists) / body_scale(keypoints, box)


class IntakeWatcher:
    """Eating / drinking for one tracked person. Feed it every analyzed frame.

        watcher = IntakeWatcher()
        state = watcher.update(t, person["keypoints"], person["box"], objects)  # 'eating' | 'drinking' | 'none'

    Drinking: a cup or bottle is in the hand and held at the mouth for DRINK_MIN_S.
    Eating:   food, a bowl or a fork/spoon is near the child, and the hand went to the
              mouth at least EAT_MIN_BITES times in the last EAT_WINDOW_S seconds.
    Drinking wins if both match (the cup is at the mouth right now).
    """

    def __init__(self):
        self.hand_up = False
        self.bites: deque = deque()          # times the hand reached the mouth
        self.last_food_t = None
        self.last_cup_t = None               # a cup / bottle was in the hand
        self.cup_at_mouth_since = None
        self.last_drinking_t = None

    def update(self, t: float, keypoints, box, objects: list[dict]) -> str:
        mouth = mouth_point(keypoints)
        scale = body_scale(keypoints, box)
        wrists = [w for w in (_visible(keypoints, 9), _visible(keypoints, 10)) if w]
        anchors = wrists + ([mouth] if mouth else [])

        # what is near this child
        cup_in_hand = cup_at_mouth = False
        for o in objects or []:
            label, c = o.get("label"), _center(o["box"])
            if label in DRINK_LABELS:
                if any(_dist(w, c) / scale <= OBJECT_AT_HAND for w in wrists):
                    cup_in_hand = True
                if mouth and _dist(mouth, c) / scale <= OBJECT_AT_MOUTH:
                    cup_at_mouth = True
            elif label in EATING_LABELS and anchors:
                if any(_dist(a, c) / scale <= FOOD_NEAR for a in anchors):
                    self.last_food_t = t
        if cup_in_hand or cup_at_mouth:
            self.last_cup_t = t

        # hand-to-mouth, with hysteresis so jitter is not counted as many bites
        d = hand_to_mouth(keypoints, box)
        reached_mouth = False
        if d is not None:
            if not self.hand_up and d <= HAND_MOUTH_NEAR:
                self.hand_up = reached_mouth = True
            elif self.hand_up and d >= HAND_MOUTH_AWAY:
                self.hand_up = False

        # drinking: cup at the mouth, or a recently held cup with the hand at the mouth
        cup_recent = self.last_cup_t is not None and t - self.last_cup_t <= DRINK_MEMORY_S
        drinking_now = cup_at_mouth or (self.hand_up and cup_recent)
        if drinking_now:
            if self.cup_at_mouth_since is None:
                self.cup_at_mouth_since = t
            if t - self.cup_at_mouth_since >= DRINK_MIN_S:
                self.last_drinking_t = t
        else:
            self.cup_at_mouth_since = None
        drinking = self.last_drinking_t is not None and t - self.last_drinking_t <= DRINK_HOLD_S

        # eating: count a bite only when food is around and it isn't a sip
        # (no cup at the mouth, in the hand, or just drunk from)
        food_recent = self.last_food_t is not None and t - self.last_food_t <= FOOD_MEMORY_S
        if reached_mouth and food_recent and not (drinking_now or drinking or cup_recent):
            self.bites.append(t)
        while self.bites and self.bites[0] < t - EAT_WINDOW_S:
            self.bites.popleft()
        eating = food_recent and len(self.bites) >= EAT_MIN_BITES

        if drinking:
            return "drinking"
        if eating:
            return "eating"
        return "none"
