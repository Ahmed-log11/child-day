"""Mock data in the exact format of docs/api.md.

Used while the real pipeline is being built (settings.use_mock_pipeline = True).
Keep these files identical to frontend/src/mocks/.
"""
import json
from pathlib import Path

MOCKS_DIR = Path(__file__).resolve().parent


def load(name: str) -> dict:
    return json.loads((MOCKS_DIR / f"{name}.json").read_text())


def mock_frames(report: dict) -> dict:
    """A few overlay frames built from the mock report, for the video review screen."""
    frames = []
    for t in [0.0, 0.33, 0.67, 1.0]:
        frames.append({
            "t": t,
            "people": [{
                "track_id": 1, "child_id": "c1",
                "box": [0.31, 0.22, 0.52, 0.88],
                "keypoints": [[0.41, 0.27, 0.98]] * 17,
                "screen": "tv", "activity": "still",
            }],
            "objects": [{"label": "tv", "box": [0.02, 0.10, 0.28, 0.45], "on": True}],
        })
    return {"analyzed_fps": report["video"]["analyzed_fps"], "frames": frames}
