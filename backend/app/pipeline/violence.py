"""Violent contact classifier (trained in training/02_violence_classifier.ipynb). Owner: P2.

The weights file `violence.pt` is NOT in git (share it through Drive / Hugging Face).
torch is imported lazily so the rest of the backend still starts without the weights.
"""
_DEFAULT_NORMAL, _DEFAULT_LOW = 0.70, 0.45


def load_model(weights_path: str):
    """Load the trained MobileNetV2 + LSTM model (once). Returns an opaque object for violent_contact_score."""
    import os
    import numpy as np
    import torch
    import torch.nn as nn
    import torchvision

    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Violence weights not found at {weights_path}. Download violence.pt first.")

    ckpt = torch.load(weights_path, map_location="cpu")
    device = "cuda" if torch.cuda.is_available() else "cpu"

    backbone = torchvision.models.mobilenet_v2(weights=torchvision.models.MobileNet_V2_Weights.IMAGENET1K_V1).features
    backbone = nn.Sequential(backbone, nn.AdaptiveAvgPool2d(1), nn.Flatten()).to(device).eval()

    class Head(nn.Module):   # must match ViolenceHead in the notebook
        def __init__(self, feat_dim, hidden):
            super().__init__()
            self.lstm = nn.LSTM(feat_dim, hidden, batch_first=True)
            self.drop = nn.Dropout(0.5)
            self.fc = nn.Linear(hidden, 1)

        def forward(self, x):
            out, _ = self.lstm(x)
            return self.fc(self.drop(out[:, -1])).squeeze(-1)

    head = Head(ckpt["feat_dim"], ckpt["hidden"]).to(device).eval()
    head.load_state_dict(ckpt["head_state"])
    return {
        "backbone": backbone, "head": head, "device": device,
        "seq_len": ckpt["seq_len"], "img": ckpt["img_size"],
        "mean": np.array(ckpt["mean"], dtype=np.float32), "std": np.array(ckpt["std"], dtype=np.float32),
        "normal_threshold": ckpt.get("normal_threshold", _DEFAULT_NORMAL),
        "low_threshold": ckpt.get("low_threshold", _DEFAULT_LOW),
    }


def _sample(frames: list, n: int) -> list:
    import numpy as np
    idx = np.linspace(0, len(frames) - 1, n).astype(int)
    return [frames[i] for i in idx]


def violent_contact_score(model, clip_frames: list) -> float:
    """Probability (0-1) that a 2-3 second clip shows violent contact.

    clip_frames: BGR uint8 images (OpenCV order), oldest first, any size >= 1 frame.
    Only called when two people are close together.
    """
    import cv2
    import numpy as np
    import torch

    if not clip_frames:
        return 0.0
    frames = _sample(clip_frames, model["seq_len"])
    img = model["img"]
    rgb = [cv2.cvtColor(cv2.resize(f, (img, img)), cv2.COLOR_BGR2RGB) for f in frames]
    x = (np.stack(rgb).astype(np.float32) / 255.0 - model["mean"]) / model["std"]
    x = torch.from_numpy(x).permute(0, 3, 1, 2).to(model["device"])
    with torch.no_grad():
        feats = model["backbone"](x).unsqueeze(0)          # (1, T, 1280)
        return float(torch.sigmoid(model["head"](feats)).item())


def violence_flag(model, score: float, child_involved: bool, other_is_adult: bool = False):
    """Rule on top of the score: returns None, "normal" or "high" (priority).

    A child in the pair uses the LOWER threshold (we accept more false alarms: a missed
    moment costs more than a clip the parent dismisses). Adult + child is "high".
    The event type stays `violent_contact`; we never say "abuse", the parent reviews the clip.
    """
    if child_involved and score >= model["low_threshold"]:
        return "high" if other_is_adult else "normal"
    if score >= model["normal_threshold"]:
        return "normal"
    return None


def escalate_priority(priority, recent_events: int):
    """Repeated incidents on the same child in one session raise the priority.

    `priority` comes from violence_flag; `recent_events` = earlier violent_contact events for that
    child in this session. Two or more earlier moments -> "high".
    """
    if priority is None:
        return None
    return "high" if recent_events >= 2 else priority


_PRIORITY_RANK = {None: 0, "normal": 1, "high": 2}


class ViolenceWatcher:
    """Turns per-window flags into ONE violent_contact event per moment.

    The Engine scores a clip every ~1 s, so one push gives several flagged windows in a row.
    Flags for the same child less than `max_gap_s` apart are one moment. Call update() after
    each violence_flag, and flush() when the video ends.

    Events follow docs/api.md exactly. The priority ("normal" / "high", already escalated for
    repeated incidents) is kept in `self.priority[event_id]` until the team agrees on a field.
    """

    def __init__(self, max_gap_s: float = 2.0):
        self.max_gap_s = max_gap_s
        self._open: dict = {}          # child_id -> {"start_s", "end_s", "score", "priority"}
        self._done_per_child: dict = {}
        self._counter = 0
        self.priority: dict = {}       # event_id -> "normal" | "high"

    def _close(self, child_id, m):
        self._counter += 1
        eid = f"violence_e{self._counter}"
        earlier = self._done_per_child.get(child_id, 0)
        self._done_per_child[child_id] = earlier + 1
        self.priority[eid] = escalate_priority(m["priority"], earlier)
        return {"id": eid, "child_id": child_id, "type": "violent_contact",
                "start_s": m["start_s"], "end_s": m["end_s"], "confidence": round(m["score"], 3),
                "zone_id": None, "clip_url": None, "reviewed": False}

    def update(self, child_id: str, priority, score: float, start_s: float, end_s: float) -> list:
        """priority/score: from violence_flag / violent_contact_score for the clip [start_s, end_s].

        Flagged windows whose ends are at most max_gap_s apart belong to one moment. The event
        spans from the first flagged clip's start to the last flagged clip's end.
        """
        events = []
        m = self._open.get(child_id)
        if m and end_s - m["end_s"] > self.max_gap_s:      # gap between flagged windows: new moment
            events.append(self._close(child_id, self._open.pop(child_id)))
            m = None
        if priority is None:
            return events
        if m is None:
            self._open[child_id] = {"start_s": start_s, "end_s": end_s, "score": score, "priority": priority}
        else:
            m["end_s"] = max(m["end_s"], end_s)
            m["score"] = max(m["score"], score)
            if _PRIORITY_RANK[priority] > _PRIORITY_RANK[m["priority"]]:
                m["priority"] = priority
        return events

    def tick(self, t: float) -> list:
        """Close moments with no flag for max_gap_s (call once per frame, also when nobody is close)."""
        events = []
        for cid in [c for c, m in self._open.items() if t - m["end_s"] > self.max_gap_s]:
            events.append(self._close(cid, self._open.pop(cid)))
        return events

    def flush(self) -> list:
        events = [self._close(cid, m) for cid, m in self._open.items()]
        self._open.clear()
        return events


# --- Body check on top of the model: are the two children really confronting each other? ------
# The model alone scores almost any fast movement as violent on home video (dancing next to each
# other scored 0.99 on a test clip). Real contact has a shape in the keypoints that dancing doesn't:
# the two face each other, at arm's length, and both reach toward the other (grab, pull, push),
# for at least a second. Measured on a test clip: struggle over a tablet = 7 frames in a row,
# dancing side by side = never more than 1.
FACE_MIN = 0.05            # head turned toward the other person by at least 5% of body height
REACH_STRONG = 0.20        # one wrist goes at least 20% of body height past the shoulders, toward the other
REACH_MIN = 0.10           # and the other person reaches at least 10%
DIST_MIN, DIST_MAX = 0.30, 1.0   # body centers apart, in body heights: arm's length (closer = hug)
CONFRONT_FRAMES = 3        # in a row (1 s at 3 fps)
_KP_CONF = 0.3
_NOSE, _L_SH, _R_SH, _L_WR, _R_WR = 0, 5, 6, 9, 10


def _pt(person, i):
    kps = person.get("keypoints") or []
    if i >= len(kps) or (kps[i][2] if len(kps[i]) > 2 else 1.0) < _KP_CONF:
        return None
    return kps[i][0], kps[i][1]


def _shoulders(person):
    pts = [p for p in (_pt(person, _L_SH), _pt(person, _R_SH)) if p]
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)) if pts else None


def _confront_frame(a: dict, b: dict, aspect: float) -> bool:
    """One frame: a and b face each other at arm's length and both reach toward the other."""
    ha, hb = a["box"][3] - a["box"][1], b["box"][3] - b["box"][1]
    h = (ha + hb) / 2
    if h <= 0:
        return False
    ca, cb = (a["box"][0] + a["box"][2]) / 2, (b["box"][0] + b["box"][2]) / 2
    if not DIST_MIN <= abs(cb - ca) * aspect / h <= DIST_MAX:
        return False
    side = 1 if cb > ca else -1                 # direction from a toward b
    faces, reaches = [], []
    for p, s, hp in ((a, side, ha), (b, -side, hb)):
        sh, nose = _shoulders(p), _pt(p, _NOSE)
        wrists = [w for w in (_pt(p, _L_WR), _pt(p, _R_WR)) if w]
        if not sh or not nose or not wrists:
            return False
        faces.append((nose[0] - sh[0]) * aspect * s / hp)
        reaches.append(max((w[0] - sh[0]) * aspect * s for w in wrists) / hp)
    return min(faces) >= FACE_MIN and max(reaches) >= REACH_STRONG and min(reaches) >= REACH_MIN


def confrontation(history_a: list, history_b: list, aspect: float = 1.0, min_frames: int = CONFRONT_FRAMES) -> bool:
    """True if the two people confronted each other for `min_frames` frames in a row.

    history_a / history_b: recent frames of each person, oldest first: {"t", "box", "keypoints"}
    (normalized, COCO order). Frames are matched by time. aspect = video width / height.
    Use it with violence_flag: no confrontation = no violent_contact event, whatever the score.
    """
    b_at = {round(f["t"], 2): f for f in history_b}
    run = best = 0
    for fa in history_a:
        fb = b_at.get(round(fa["t"], 2))
        if fb is not None and fa.get("box") and fb.get("box") and _confront_frame(fa, fb, aspect):
            run += 1
            best = max(best, run)
        else:
            run = 0
    return best >= min_frames
