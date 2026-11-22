"""Upload mode: read a video file and feed its frames to the Engine.

Owner: P4. Called from app/api/jobs.py -> process_video().
"""


def run_video(video_path: str, children: list[dict], zones: list[dict], on_progress=None) -> dict:
    """Sample frames at analyzed_fps, call Engine.process_frame, return Engine.finish().

    on_progress(percent: int, step: str) updates the job for the processing screen.
    """
    raise NotImplementedError
