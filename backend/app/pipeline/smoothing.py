"""Turns noisy per-second states into clean segments. Owner: P1.

Steps:
1. Split the samples where there is a time gap (e.g. frames missing in live mode).
2. Majority filter over a short window to remove single-frame flicker.
3. Runs shorter than `window_s` are merged into a neighbour (the shortest run first),
   so every segment lasts at least `window_s` unless the whole piece is shorter.
4. Neighbouring runs with the same state are joined.

Segments are back to back: each one ends where the next starts, so they never overlap.
A sample at time t covers [t, next sample t).
"""
from __future__ import annotations

from collections import Counter

# ---------------------------------------------------------------------------
# Settings (tune here)
# ---------------------------------------------------------------------------
GAP_S = 3.0                 # a gap longer than this between samples splits the timeline
MAJORITY_WINDOW_S = 2.0     # flicker filter width (centred on each sample)
ROUND = 2                   # decimals for start_s / end_s


def _median_dt(times: list[float]) -> float:
    diffs = sorted(b - a for a, b in zip(times, times[1:]) if b > a)
    return diffs[len(diffs) // 2] if diffs else 1.0


def _majority_filter(times: list[float], states: list[str], half: float) -> list[str]:
    if half <= 0 or len(states) < 3:
        return list(states)
    out = []
    lo = hi = 0
    n = len(states)
    for i, t in enumerate(times):
        while times[lo] < t - half:
            lo += 1
        while hi + 1 < n and times[hi + 1] <= t + half:
            hi += 1
        counts = Counter(states[lo:hi + 1])
        best = max(counts.values())
        # keep the current state on a tie, so the filter never invents a change
        out.append(states[i] if counts[states[i]] == best else counts.most_common(1)[0][0])
    return out


def _runs(times: list[float], states: list[str], end: float) -> list[list]:
    runs: list[list] = []   # [state, start, end]
    for i, (t, s) in enumerate(zip(times, states)):
        nxt = times[i + 1] if i + 1 < len(times) else end
        if runs and runs[-1][0] == s:
            runs[-1][2] = nxt
        else:
            runs.append([s, t, nxt])
    return runs


def _merge_short(runs: list[list], min_len: float) -> list[list]:
    while len(runs) > 1:
        idx, shortest = None, None
        for i, r in enumerate(runs):
            d = r[2] - r[1]
            if d < min_len and (shortest is None or d < shortest):
                idx, shortest = i, d
        if idx is None:
            break
        left = runs[idx - 1] if idx > 0 else None
        right = runs[idx + 1] if idx + 1 < len(runs) else None
        if left and right and left[0] == right[0]:
            left[2] = right[2]                       # A b A -> A
            del runs[idx:idx + 2]
        elif left and (not right or (left[2] - left[1]) >= (right[2] - right[1])):
            left[2] = runs[idx][2]                   # into the longer neighbour
            del runs[idx]
        else:
            right[1] = runs[idx][1]
            del runs[idx]
    return runs


def _smooth_chunk(times: list[float], states: list[str], window_s: float, dt: float) -> list[dict]:
    end = times[-1] + dt
    if end - times[0] < window_s:
        # too short to split: one segment with the state that lasted longest
        dur: Counter = Counter()
        for i, s in enumerate(states):
            dur[s] += (times[i + 1] if i + 1 < len(times) else end) - times[i]
        return [{"state": dur.most_common(1)[0][0], "start_s": times[0], "end_s": end}]

    half = min(MAJORITY_WINDOW_S, window_s / 2.0) / 2.0
    filtered = _majority_filter(times, states, half)
    runs = _merge_short(_runs(times, filtered, end), window_s)
    return [{"state": s, "start_s": a, "end_s": b} for s, a, b in runs]


def smooth(states: list[tuple[float, str]], window_s: float = 10.0) -> list[dict]:
    """[(t, state), ...] -> [{"state", "start_s", "end_s"}] with short flickers removed."""
    samples = sorted(((float(t), s) for t, s in states if s is not None), key=lambda x: x[0])
    if not samples:
        return []

    times = [t for t, _ in samples]
    labels = [s for _, s in samples]
    dt = _median_dt(times)
    gap = max(GAP_S, 3 * dt)

    segments: list[dict] = []
    start = 0
    for i in range(1, len(times) + 1):
        if i == len(times) or times[i] - times[i - 1] > gap:
            segments.extend(_smooth_chunk(times[start:i], labels[start:i], window_s, dt))
            start = i

    # join equal neighbours that touch (can happen across chunk borders)
    merged: list[dict] = []
    for seg in segments:
        if merged and merged[-1]["state"] == seg["state"] and abs(merged[-1]["end_s"] - seg["start_s"]) < 1e-6:
            merged[-1]["end_s"] = seg["end_s"]
        else:
            merged.append(dict(seg))
    for seg in merged:
        seg["start_s"] = round(seg["start_s"], ROUND)
        seg["end_s"] = round(seg["end_s"], ROUND)
    return merged
