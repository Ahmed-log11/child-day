"""Saves uploads and alert clips: local folder by default, Supabase Storage when configured. Owner: P4."""
import shutil
import subprocess
from pathlib import Path

import cv2
import httpx

from app.config import settings

CLIP_PADDING_S = 5.0


def cut_clip(video_path: str, start_s: float, end_s: float, out_path: str) -> str:
    # Cuts from 5 s before the alert to 5 s after it into a short mp4
    start = max(0.0, start_s - CLIP_PADDING_S)
    end = end_s + CLIP_PADDING_S
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)

    # With ffmpeg: H.264, which every browser can play
    if shutil.which("ffmpeg"):
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.2f}", "-i", video_path,
             "-t", f"{end - start:.2f}", "-an", "-c:v", "libx264", "-preset", "veryfast",
             "-movflags", "+faststart", out_path],
            check=True,
        )
        return out_path

    # Without ffmpeg (e.g. a laptop): OpenCV fallback
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    size = (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
    cap.set(cv2.CAP_PROP_POS_MSEC, start * 1000)
    writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, size)
    try:
        while True:
            ok, frame = cap.read()
            if not ok or cap.get(cv2.CAP_PROP_POS_MSEC) / 1000 > end:
                break
            writer.write(frame)
    finally:
        writer.release()
        cap.release()
    return out_path


def save_clip(local_path: str, name: str) -> str:
    """Store a clip and return its URL."""
    # Supabase Storage when configured (production)
    if settings.supabase_url and settings.supabase_key:
        base = settings.supabase_url.rstrip("/")
        bucket = settings.supabase_bucket
        with open(local_path, "rb") as f:
            r = httpx.post(
                f"{base}/storage/v1/object/{bucket}/{name}",
                headers={"Authorization": f"Bearer {settings.supabase_key}", "apikey": settings.supabase_key,
                         "Content-Type": "video/mp4", "x-upsert": "true"},
                content=f.read(), timeout=60,
            )
        r.raise_for_status()
        Path(local_path).unlink(missing_ok=True)
        return f"{base}/storage/v1/object/public/{bucket}/{name}"

    # Otherwise a local folder (storage/clips), served by the API under /clips
    clips = settings.storage_dir / "clips"
    clips.mkdir(parents=True, exist_ok=True)
    dest = clips / name
    shutil.move(local_path, dest)
    return f"/clips/{name}"