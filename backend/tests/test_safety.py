"""P2 safety rules: zones, falls, violence flag and one-event-per-moment merging.

Pure Python: no model weights, no torch, no video needed.
"""
from app.pipeline.fall import FallWatcher, detect_fall, lying_still
from app.pipeline.violence import ViolenceWatcher, confrontation, escalate_priority, violence_flag
from app.pipeline.zones import ZoneWatcher, dangerous_object_near, in_zone

EVENT_KEYS = {"id", "child_id", "type", "start_s", "end_s", "confidence", "zone_id", "clip_url", "reviewed"}
KITCHEN = {"id": "z1", "name": "Kitchen", "polygon": [[0.6, 0.6], [1.0, 0.6], [1.0, 1.0], [0.6, 1.0]]}
MODEL = {"normal_threshold": 0.70, "low_threshold": 0.45}


# ---------- helpers ----------------------------------------------------------------------------
def person(feet=(0.3, 0.9), wrists=None):
    kps = [[0.0, 0.0, 0.0] for _ in range(17)]
    kps[15] = [feet[0] - 0.02, feet[1], 0.9]
    kps[16] = [feet[0] + 0.02, feet[1], 0.9]
    if wrists:
        kps[9] = [wrists[0], wrists[1], 0.9]
        kps[10] = [wrists[0], wrists[1], 0.9]
    return {"track_id": 1, "box": [feet[0] - 0.1, feet[1] - 0.6, feet[0] + 0.1, feet[1]], "keypoints": kps}


def pose(t, upright, hip_y):
    """A frame whose torso is vertical (upright) or horizontal (lying)."""
    kps = [[0.0, 0.0, 0.0] for _ in range(17)]
    if upright:
        sh, hp = (0.5, hip_y - 0.25), (0.5, hip_y)
    else:
        sh, hp = (0.25, hip_y), (0.5, hip_y)
    for i in (5, 6):
        kps[i] = [sh[0], sh[1], 0.9]
    for i in (11, 12):
        kps[i] = [hp[0], hp[1], 0.9]
    return {"t": t, "box": [0.2, 0.2, 0.8, 0.9], "keypoints": kps}


def fall_frames(t0=0.0, standing_s=1.0, down_s=3.0, fps=3):
    frames, t = [], t0
    while t < t0 + standing_s:
        frames.append(pose(round(t, 2), True, 0.5)); t += 1 / fps
    while t < t0 + standing_s + down_s:
        frames.append(pose(round(t, 2), False, 0.85)); t += 1 / fps
    return frames


def lie_down_on_purpose(fps=3):
    """Sit down (hips go low, torso stays upright), then lean back onto the floor."""
    frames, t = [], 0.0
    for k in range(2 * fps):                       # standing -> sitting over 2 s
        frames.append(pose(t, True, 0.5 + 0.3 * k / (2 * fps))); t += 1 / fps
    for _ in range(fps):                           # sitting 1 s
        frames.append(pose(t, True, 0.8)); t += 1 / fps
    for _ in range(3 * fps):                       # lying back, hips stay where they were
        frames.append(pose(t, False, 0.82)); t += 1 / fps
    return frames


# ---------- zones ------------------------------------------------------------------------------
def test_in_zone():
    assert in_zone(person(feet=(0.8, 0.8)), KITCHEN)
    assert not in_zone(person(feet=(0.3, 0.8)), KITCHEN)
    assert not in_zone(person(), {"id": "z", "polygon": [[0, 0], [1, 1]]})   # not a polygon


def test_one_kitchen_visit_is_one_event():
    w, events = ZoneWatcher(), []
    for k in range(30):                            # 10 s at 3 fps, inside from 2 s to 7 s
        t = k / 3
        inside = 2 <= t <= 7
        events += w.update("c1", person(feet=(0.8, 0.8) if inside else (0.3, 0.8)), [KITCHEN], t)
    events += w.flush()
    assert len(events) == 1
    ev = events[0]
    assert set(ev) == EVENT_KEYS and ev["type"] == "danger_zone" and ev["zone_id"] == "z1"
    assert 1.9 <= ev["start_s"] <= 2.4 and 6.6 <= ev["end_s"] <= 7.1


def test_walking_past_the_kitchen_gives_no_event():
    w, events = ZoneWatcher(), []
    for k in range(3):                             # under 1 s inside: below min_dwell_s
        events += w.update("c1", person(feet=(0.8, 0.8)), [KITCHEN], k / 3)
    events += w.update("c1", person(feet=(0.3, 0.8)), [KITCHEN], 5.0)
    assert events + w.flush() == []


def test_dangerous_object_near_hands():
    knife = [{"label": "knife", "box": [0.40, 0.40, 0.45, 0.45]}]
    assert dangerous_object_near(person(wrists=(0.42, 0.42)), knife) == "knife"
    assert dangerous_object_near(person(wrists=(0.10, 0.10)), knife) is None
    assert dangerous_object_near(person(wrists=(0.42, 0.42)), [{"label": "cup", "box": [0.4, 0.4, 0.45, 0.45]}]) is None


# ---------- fall -------------------------------------------------------------------------------
def test_detect_fall():
    assert detect_fall(fall_frames())
    assert not detect_fall(fall_frames(down_s=1.0))            # not down long enough yet
    assert not detect_fall([pose(k / 3, True, 0.5) for k in range(12)])   # just standing
    assert not detect_fall(lie_down_on_purpose())              # sitting, then lying back


def test_small_child_far_from_camera_falls():
    """Real case from a test clip: hips dropped 0.09 of the frame, about a quarter of the child's height."""
    frames = []
    for k in range(3):                                   # standing, box 0.42 tall
        f = pose(k / 3, True, 0.61); f["box"] = [0.40, 0.40, 0.55, 0.82]; frames.append(f)
    for k in range(3, 12):                               # on the floor, box now short and wide
        f = pose(k / 3, False, 0.70); f["box"] = [0.29, 0.62, 0.44, 0.81]; frames.append(f)
    assert detect_fall(frames)
    for f in frames:                                     # same drop, no box: frame-height rule, too small
        f.pop("box")
    assert not detect_fall(frames)


def test_one_fall_is_one_event():
    w, frames, events = FallWatcher(), fall_frames(down_s=6.0), []
    for i, f in enumerate(frames):
        events += w.update("c1", frames[max(0, i - 12):i + 1], f["t"])   # 4 s sliding history
    assert len(events) == 1
    ev = events[0]
    assert set(ev) == EVENT_KEYS and ev["type"] == "fall" and ev["child_id"] == "c1"
    assert ev["start_s"] < 1.0 < ev["end_s"]


def test_two_falls_after_getting_up_are_two_events():
    frames = fall_frames(0.0) + fall_frames(5.0)
    w, events = FallWatcher(), []
    for i, f in enumerate(frames):
        events += w.update("c1", frames[max(0, i - 12):i + 1], f["t"])
    assert len(events) == 2


def test_lying_still_raises_fall_priority():
    frames = fall_frames(down_s=13.0)
    w, events = FallWatcher(), []
    for i, f in enumerate(frames):
        events += w.update("c1", frames[max(0, i - 33):i + 1], f["t"])   # 11 s history
    assert len(events) == 1
    assert w.priority[events[0]["id"]] == "high"
    assert lying_still(frames[3:])


# ---------- violence ---------------------------------------------------------------------------
def test_violence_flag_rule():
    assert violence_flag(MODEL, 0.5, child_involved=False) is None
    assert violence_flag(MODEL, 0.8, child_involved=False) == "normal"
    assert violence_flag(MODEL, 0.5, child_involved=True) == "normal"            # lower threshold
    assert violence_flag(MODEL, 0.5, child_involved=True, other_is_adult=True) == "high"
    assert violence_flag(MODEL, 0.3, child_involved=True, other_is_adult=True) is None
    assert escalate_priority("normal", 2) == "high" and escalate_priority(None, 5) is None


def run_windows(w, scores, child="c1", other_is_adult=False, step=1.0):
    events = []
    for k, s in enumerate(scores):
        end = 5.0 + k * step
        flag = violence_flag(MODEL, s, child_involved=True, other_is_adult=other_is_adult)
        events += w.update(child, flag, s, end - 5.33, end)
        events += w.tick(end)
    return events + w.flush()


def test_one_push_is_one_event():
    events = run_windows(ViolenceWatcher(), [0.1, 0.6, 0.9, 0.95, 0.7, 0.2, 0.1, 0.1])
    assert len(events) == 1
    ev = events[0]
    assert set(ev) == EVENT_KEYS and ev["type"] == "violent_contact" and ev["zone_id"] is None
    assert ev["confidence"] == 0.95


def test_hug_gives_no_event():
    assert run_windows(ViolenceWatcher(), [0.1, 0.2, 0.3, 0.25, 0.1]) == []


def test_two_pushes_far_apart_are_two_events_and_escalate():
    w = ViolenceWatcher()
    scores = [0.9, 0.9] + [0.1] * 5 + [0.8] + [0.1] * 5 + [0.8]
    events = run_windows(w, scores)
    assert len(events) == 3
    assert [w.priority[e["id"]] for e in events] == ["normal", "normal", "high"]


def body(cx, look, reach, t):
    """A standing person at x=cx: head turned by `look`, furthest wrist `reach` past the shoulders (+ = right)."""
    kps = [[0.0, 0.0, 0.0] for _ in range(17)]
    kps[0] = [cx + look, 0.30, 0.9]                                 # nose
    kps[5], kps[6] = [cx - 0.03, 0.38, 0.9], [cx + 0.03, 0.38, 0.9]  # shoulders
    kps[9], kps[10] = [cx + reach, 0.50, 0.9], [cx, 0.55, 0.9]      # wrists
    return {"t": t, "box": [cx - 0.08, 0.25, cx + 0.08, 0.85], "keypoints": kps}


def pair(n, a_x, b_x, a_look, b_look, a_reach, b_reach):
    return ([body(a_x, a_look, a_reach, k / 3) for k in range(n)],
            [body(b_x, b_look, b_reach, k / 3) for k in range(n)])


def test_struggle_is_a_confrontation():
    # facing each other at arm's length, both pulling toward the middle
    assert confrontation(*pair(6, 0.40, 0.70, +0.05, -0.05, +0.14, -0.10))


def test_dancing_side_by_side_is_not():
    # same distance, but both face the camera and wave their arms outward
    assert not confrontation(*pair(6, 0.40, 0.70, 0.0, 0.0, -0.14, +0.14))


def test_hug_is_not():
    # facing each other but bodies almost together
    assert not confrontation(*pair(6, 0.50, 0.55, +0.05, -0.05, +0.12, -0.12))


def test_one_frame_of_contact_is_not_enough():
    assert not confrontation(*pair(2, 0.40, 0.70, +0.05, -0.05, +0.14, -0.10))


def test_adult_involved_is_high_priority():
    w = ViolenceWatcher()
    events = run_windows(w, [0.5, 0.6], other_is_adult=True)
    assert len(events) == 1 and w.priority[events[0]["id"]] == "high"
