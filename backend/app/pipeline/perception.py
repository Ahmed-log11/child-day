"""YOLO11 detection + pose + ByteTrack. Owner: P1.

All boxes and keypoints returned here are normalized 0-1 (fraction of frame width/height),
as required by docs/api.md.

Models are loaded once (see `load_models`) and cached at module level, so calling
`detect_objects` / `detect_people` per frame never reloads weights. `Engine.__init__`
calls `load_models()` and `reset_tracking()`; the detect functions also load lazily
if someone calls them directly (notebooks, quick scripts).

Weights live in `backend/weights/` (never committed). If an OpenVINO export exists there
it is used automatically (faster on CPU); otherwise the `.pt` file is used, and the
pretrained COCO models are downloaded there by Ultralytics on first use.
"""
from __future__ import annotations

import threading
from pathlib import Path

# ---------------------------------------------------------------------------
# Settings (tune here)
# ---------------------------------------------------------------------------
WEIGHTS_DIR = Path(__file__).resolve().parents[2] / "weights"   # backend/weights

DETECT_WEIGHTS = "yolo11n.pt"            # pretrained COCO detector
POSE_WEIGHTS = "yolo11n-pose.pt"         # pretrained COCO pose (17 keypoints)
# P4's fine-tuned tablet detector. First file/folder found is used; none found = fallback below.
TABLET_WEIGHTS = ["tablet_openvino_model", "tablet.pt", "yolo11n_tablet.pt", "best.pt"]
# Off for now: on a wide room view the fine-tuned model marks the TV, doorways and cushions as
# tablets and misses the real one. COCO sees a hand-held tablet as a small "laptop" (below).
USE_TABLET_MODEL = False

IMGSZ = 480                 # 480 or 416 keeps it fast on a free CPU (pose + tracking)
OBJECT_IMGSZ = 800          # objects are small (a tablet in a hand): 800 finds it, 640 misses it
DEVICE = "cpu"
OBJECT_CONF = 0.30          # min confidence for COCO objects
TABLET_CONF = 0.35          # min confidence for the tablet model
PERSON_CONF = 0.30          # min confidence for people (pose model)
TRACKER = "bytetrack.yaml"

# COCO labels we keep, mapped to the label names used in the API contract.
OBJECT_LABELS = {
    "tv": "tv",
    "cell phone": "phone",
    "laptop": "laptop",
    "remote": "remote",
    "cup": "cup",
    "bottle": "bottle",
    "book": "book",
    "scissors": "scissors",
    "knife": "knife",            # kept as "knife": P2's zones.dangerous_object_near relies on it
    # eating / drinking (activity.IntakeWatcher)
    "wine glass": "cup",
    "bowl": "bowl",
    "fork": "utensil",
    "spoon": "utensil",
    "banana": "food",
    "apple": "food",
    "sandwich": "food",
    "orange": "food",
    "broccoli": "food",
    "carrot": "food",
    "hot dog": "food",
    "pizza": "food",
    "donut": "food",
    "cake": "food",
}

# Until P4's tablet model exists: a "cell phone" box bigger than this fraction of the
# frame area is treated as a tablet.
BIG_PHONE_AS_TABLET = True
TABLET_MIN_AREA = 0.006
# COCO calls a tablet held in the hands a "laptop". A real laptop is bigger than this.
SMALL_LAPTOP_AS_TABLET = True
TABLET_MAX_AREA = 0.02
# Two boxes of the same label overlapping this much are the same object (e.g. one TV seen twice).
SAME_OBJECT_IOU = 0.5
# A phone box overlapping a tablet box this much is the same device -> keep the tablet.
TABLET_PHONE_IOU = 0.45

ROUND = 4                   # decimals in the JSON output

# ---------------------------------------------------------------------------
# Model loading (once)
# ---------------------------------------------------------------------------
_models: dict = {}
_load_lock = threading.Lock()
_track_lock = threading.Lock()   # ByteTrack state lives inside the pose model


def _resolve(name: str) -> str:
    """Prefer an OpenVINO export next to the weights, then the .pt file in weights/."""
    stem = Path(name).stem
    ov = WEIGHTS_DIR / f"{stem}_openvino_model"
    if ov.is_dir():
        return str(ov)
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    return str(WEIGHTS_DIR / name)   # Ultralytics downloads official weights to this path


def _find_tablet_weights() -> str | None:
    for name in TABLET_WEIGHTS:
        p = WEIGHTS_DIR / name
        if p.exists():
            return str(p)
    return None


def load_models() -> dict:
    """Load detector, pose model and (if present) the tablet model. Safe to call many times."""
    if _models:
        return _models
    with _load_lock:
        if _models:
            return _models
        from ultralytics import YOLO

        _models["detect"] = YOLO(_resolve(DETECT_WEIGHTS), task="detect")
        _models["pose"] = YOLO(_resolve(POSE_WEIGHTS), task="pose")
        tablet_path = _find_tablet_weights() if USE_TABLET_MODEL else None
        _models["tablet"] = YOLO(tablet_path, task="detect") if tablet_path else None
    return _models


def reset_tracking() -> None:
    """Start ByteTrack fresh (new video / new live session): track IDs restart at 1."""
    pose = _models.get("pose")
    predictor = getattr(pose, "predictor", None) if pose is not None else None
    trackers = getattr(predictor, "trackers", None) if predictor is not None else None
    if trackers:
        for tracker in trackers:
            tracker.reset()


def export_openvino() -> list[str]:
    """Export the COCO models to OpenVINO in backend/weights/ (step 4: speed). Run once, offline."""
    from ultralytics import YOLO

    out = []
    for name in (DETECT_WEIGHTS, POSE_WEIGHTS):
        model = YOLO(str(WEIGHTS_DIR / name))
        out.append(model.export(format="openvino", imgsz=IMGSZ, half=False))
    _models.clear()   # next load_models() picks up the exported versions
    return out


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _r(values) -> list[float]:
    return [round(float(v), ROUND) for v in values]


def _area(box) -> float:
    return max(0.0, box[2] - box[0]) * max(0.0, box[3] - box[1])


def _iou(a, b) -> float:
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    union = _area(a) + _area(b) - inter
    return inter / union if union > 0 else 0.0


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------
def detect_objects(frame) -> list[dict]:
    """TV, phone, tablet, cup... -> [{"label", "box", "confidence"}] (normalized boxes)."""
    if frame is None:
        return []
    models = load_models()

    objects: list[dict] = []
    result = models["detect"].predict(frame, imgsz=OBJECT_IMGSZ, conf=OBJECT_CONF, device=DEVICE, verbose=False)[0]
    names = result.names
    if result.boxes is not None and len(result.boxes):
        boxes = result.boxes.xyxyn.cpu().numpy()
        confs = result.boxes.conf.cpu().numpy()
        classes = result.boxes.cls.cpu().numpy().astype(int)
        for box, conf, cls in zip(boxes, confs, classes):
            label = OBJECT_LABELS.get(names[int(cls)])
            if label is None:
                continue
            box = _r(box)
            if label == "phone" and BIG_PHONE_AS_TABLET and models["tablet"] is None and _area(box) >= TABLET_MIN_AREA:
                label = "tablet"
            if label == "laptop" and SMALL_LAPTOP_AS_TABLET and _area(box) <= TABLET_MAX_AREA:
                label = "tablet"
            objects.append({"label": label, "box": box, "confidence": round(float(conf), 3)})

    # P4's tablet model (COCO has no tablet class)
    tablet_model = models["tablet"]
    if tablet_model is not None:
        tres = tablet_model.predict(frame, imgsz=OBJECT_IMGSZ, conf=TABLET_CONF, device=DEVICE, verbose=False)[0]
        tnames = tres.names
        tablet_ids = {i for i, n in tnames.items() if "tablet" in str(n).lower()} or set(tnames)
        tablets = []
        if tres.boxes is not None and len(tres.boxes):
            for box, conf, cls in zip(tres.boxes.xyxyn.cpu().numpy(), tres.boxes.conf.cpu().numpy(),
                                      tres.boxes.cls.cpu().numpy().astype(int)):
                if int(cls) in tablet_ids:
                    tablets.append({"label": "tablet", "box": _r(box), "confidence": round(float(conf), 3)})
        if tablets:
            # drop COCO "phone" boxes that are really the same tablet
            objects = [o for o in objects if not (
                o["label"] == "phone" and any(_iou(o["box"], t["box"]) >= TABLET_PHONE_IOU for t in tablets))]
            objects.extend(tablets)

    return _dedupe(objects)


def _dedupe(objects: list[dict]) -> list[dict]:
    """Keep one box per object: drop a box that overlaps a stronger box with the same label."""
    kept: list[dict] = []
    for o in sorted(objects, key=lambda x: -x["confidence"]):
        if not any(k["label"] == o["label"] and _iou(k["box"], o["box"]) >= SAME_OBJECT_IOU for k in kept):
            kept.append(o)
    return kept


def detect_people(frame) -> list[dict]:
    """People with keypoints and a stable track_id -> [{"track_id", "box", "keypoints"}].

    keypoints: 17 COCO points as [x, y, conf], normalized. Undetected points have conf ~0.
    People that ByteTrack has not confirmed yet (no ID) are skipped.
    """
    if frame is None:
        return []
    models = load_models()
    with _track_lock:
        result = models["pose"].track(
            frame, persist=True, tracker=TRACKER, imgsz=IMGSZ, conf=PERSON_CONF,
            classes=[0], device=DEVICE, verbose=False,
        )[0]

    boxes = result.boxes
    if boxes is None or len(boxes) == 0 or boxes.id is None:
        return []

    xyxyn = boxes.xyxyn.cpu().numpy()
    ids = boxes.id.cpu().numpy().astype(int)
    kp_xy = kp_conf = None
    if result.keypoints is not None and len(result.keypoints):
        kp_xy = result.keypoints.xyn.cpu().numpy()
        kp_conf = result.keypoints.conf.cpu().numpy() if result.keypoints.conf is not None else None

    people = []
    for i, (box, tid) in enumerate(zip(xyxyn, ids)):
        keypoints = []
        if kp_xy is not None and i < len(kp_xy):
            for j, (x, y) in enumerate(kp_xy[i]):
                c = float(kp_conf[i][j]) if kp_conf is not None else 1.0
                keypoints.append([round(float(x), ROUND), round(float(y), ROUND), round(c, 3)])
        if len(keypoints) != 17:
            keypoints = [[0.0, 0.0, 0.0] for _ in range(17)]
        people.append({"track_id": int(tid), "box": _r(box), "keypoints": keypoints})
    return people
