"""Movement per person. Owner: P1.

movement_score() measures how far the keypoints moved between two frames, divided by
body size, so a child close to the camera and one far away score the same.

activity_state() expects movement PER SECOND (movement_score / seconds between the two
frames). The Engine does this division and averages over ~2 s, so the cut-offs below
do not depend on the analyzed fps.
"""
from __future__ import annotations

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
