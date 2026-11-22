"""Movement per person. Owner: P1."""


def movement_score(prev_keypoints, keypoints, box) -> float:
    """Keypoint motion between two frames, normalized by body size."""
    raise NotImplementedError


def activity_state(score: float) -> str:
    """'active', 'light' or 'still' using thresholds from config."""
    raise NotImplementedError
