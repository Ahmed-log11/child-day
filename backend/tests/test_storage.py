import cv2
import numpy as np

from app import storage
from app.config import settings


def make_video(path, seconds=20, fps=30):
    # Creates a small black test video
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), fps, (64, 48))
    for _ in range(seconds * fps):
        writer.write(np.zeros((48, 64, 3), dtype=np.uint8))
    writer.release()


def test_cut_and_save_clip_locally(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_dir", tmp_path)
    monkeypatch.setattr(settings, "supabase_url", "")
    video = tmp_path / "video.avi"
    make_video(video)

    clip = storage.cut_clip(str(video), 10, 11, str(tmp_path / "tmp" / "e1.mp4"))
    url = storage.save_clip(clip, "s1_e1.mp4")

    assert url == "/clips/s1_e1.mp4"
    assert (tmp_path / "clips" / "s1_e1.mp4").stat().st_size > 0