"""The engine: takes frames one by one and keeps state. Used by both upload and live mode.

Owner: P1 (with P2's safety parts plugged in).
"""


class Engine:
    def __init__(self, children: list[dict], zones: list[dict], analyzed_fps: float = 3.0):
        """Load the models once and set up tracking, smoothing and buffers."""
        raise NotImplementedError

    def process_frame(self, frame, t: float) -> dict:
        """Analyze one frame at time t (seconds).

        Returns one entry in the 'Frame overlays' format of docs/api.md,
        plus any new alerts: {"frame": {...}, "alerts": [...]}.
        """
        raise NotImplementedError

    def finish(self) -> dict:
        """Close the session and return the full 'Session report' (docs/api.md)."""
        raise NotImplementedError
