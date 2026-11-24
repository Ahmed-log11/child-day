"""Reads a video at ~3 fps and feeds the frames to the Engine. Owner: P4."""
import cv2

from app.pipeline.engine import Engine

TARGET_FPS = 3.0


def _step_name(percent: int) -> str:
    # Text shown on the processing screen for each stage
    if percent < 30:
        return "Finding people, TVs, tablets and phones"
    if percent < 70:
        return "Following the children"
    return "Checking movement and safety"


def run_video(video_path: str, children: list[dict], zones: list[dict], on_progress, return_frames: bool = False):
    # Opens the video, fails with a clear message if it can't be read
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    try:
        # How many frames to skip (30 fps -> keep every 10th)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        step = max(1, round(fps / TARGET_FPS))

        engine = Engine(children, zones, analyzed_fps=fps / step)
        on_progress(0, "Video received")

        idx = 0
        while True:
            # Skips unwanted frames cheaply, decodes only the kept ones
            if not cap.grab():
                break
            if idx % step == 0:
                ok, frame = cap.retrieve()
                if ok:
                    # Sends the frame and its time in seconds to the Engine
                    engine.process_frame(frame, idx / fps)
                    if total:
                        percent = min(95, int(idx / total * 100))
                        on_progress(percent, _step_name(percent))
            idx += 1

        # Asks the Engine for the final report
        on_progress(96, "Writing the day's report")
        report = engine.finish()
        on_progress(100, "Done")
        if return_frames:  # the API also saves the overlays for the review screen
            return report, engine.get_frames()
        return report
    finally:
        cap.release()