import cv2
import numpy as np
import pytest

import app.pipeline.run as run_module


class FakeEngine:
    # Stands in for the real Engine: records the times it receives
    def __init__(self, children, zones, analyzed_fps=3.0):
        self.times = []

    def process_frame(self, frame, t):
        self.times.append(t)
        return {"frame": {"t": t, "people": [], "objects": []}, "alerts": []}

    def finish(self):
        return {"times": self.times}

    def get_frames(self):
        return {"analyzed_fps": 3.0, "frames": [{"t": t} for t in self.times]}


def make_video(path, seconds=3, fps=30):
    # Creates a tiny black test video
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), fps, (64, 48))
    for _ in range(seconds * fps):
        writer.write(np.zeros((48, 64, 3), dtype=np.uint8))
    writer.release()


def test_run_video_keeps_three_frames_per_second(tmp_path, monkeypatch):
    monkeypatch.setattr(run_module, "Engine", FakeEngine)
    video = tmp_path / "test.avi"
    make_video(video)

    progress = []
    result = run_module.run_video(str(video), [], [], lambda p, s: progress.append((p, s)))

    assert len(result["times"]) == 9
    assert result["times"][0] == 0
    assert result["times"][1] == pytest.approx(10 / 30)
    assert progress[0] == (0, "Video received")
    assert progress[-1][0] == 100   




def test_run_video_saves_frames(tmp_path, monkeypatch):
    monkeypatch.setattr(run_module, "Engine", FakeEngine)
    video = tmp_path / "test.avi"
    make_video(video)
    out = tmp_path / "frames" / "s1.json"

    run_module.run_video(str(video), [], [], lambda p, s: None, frames_path=str(out))

    import json
    saved = json.loads(out.read_text())
    assert len(saved["frames"]) == 9