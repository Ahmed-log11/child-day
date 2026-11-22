"""Turns noisy per-second states into clean segments. Owner: P1."""


def smooth(states: list[tuple[float, str]], window_s: float = 10.0) -> list[dict]:
    """[(t, state), ...] -> [{"state", "start_s", "end_s"}] with short flickers removed."""
    raise NotImplementedError
