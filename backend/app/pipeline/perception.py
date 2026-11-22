"""YOLO11 detection + pose + ByteTrack. Owner: P1."""


def detect_objects(frame) -> list[dict]:
    """TV, phone, tablet, cup... -> [{"label", "box", "confidence"}] (normalized boxes)."""
    raise NotImplementedError


def detect_people(frame) -> list[dict]:
    """People with keypoints and a stable track_id -> [{"track_id", "box", "keypoints"}]."""
    raise NotImplementedError
