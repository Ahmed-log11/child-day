"""The engine: takes frames one by one and keeps state. Used by both upload and live mode.

Owner: P1 (with P2's safety parts plugged in).

Per frame:
    perception  -> objects + people (track_id, box, keypoints)
    child match -> track_id -> child_id (order of appearance, re-linked after ID switches)
    screens     -> TV on/off, who holds which device, screen state per person
    activity    -> movement score per person -> active / light / still
                   eating / drinking per person (activity.IntakeWatcher) -> "intake"
    safety (P2) -> zones.in_zone, fall.detect_fall, violence.violent_contact_score
At the end:
    smoothing   -> presence / screen / activity / intake segments per child
    report (P4) -> report.build_report(session, children, segments, events)

The engine never needs the whole video: every step works frame by frame (live mode).
P2's functions are called defensively: while one still raises NotImplementedError,
that safety check is switched off and everything else keeps working.
"""
from __future__ import annotations

import logging
from collections import Counter, deque
from datetime import date

import numpy as np

from . import activity, perception, screens, smoothing
from . import fall as fall_mod
from . import report as report_mod
from . import violence as violence_mod
from . import zones as zones_mod

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Settings (tune here)
# ---------------------------------------------------------------------------
# child matching
MIN_TRACK_FRAMES = 3          # a new track must be seen this many frames before it gets a child
REID_MAX_DIST = 0.35          # a new track takes over a lost child only if this close (normalized)
MAX_AUTO_CHILDREN = 4         # when no children are given, up to this many are created
TRACK_FORGET_S = 15.0         # drop per-track buffers after this long unseen

# speed: objects (TV, tablet, phone) barely move, so detect them every N frames and reuse the boxes
OBJECTS_EVERY_N = 2

# activity
ACTIVITY_AVG_S = 2.0          # movement is averaged over this window before activity_state()
MAX_MOVE_DT = 2.0             # frames further apart than this are not compared

# smoothing windows (seconds)
SCREEN_WINDOW_S = 3.0         # short, so a few seconds on a tablet still show
ACTIVITY_WINDOW_S = 4.0
INTAKE_WINDOW_S = 2.0         # short: a sip of a drink only lasts a few seconds
PRESENCE_WINDOW_S = 3.0

# safety events
EVENT_GAP_S = 2.0             # an event closes after it has been inactive this long
ZONE_MIN_S = 1.0              # must stay in a danger zone this long before an alert
FALL_HISTORY_S = 6.0          # history passed to fall.detect_fall
VIOLENCE_CLIP_S = 16 / 3      # the model was trained on 16 frames (16 frames at 3 fps)
VIOLENCE_EVERY_S = 1.0        # run the classifier at most this often
VIOLENCE_THRESHOLD = 0.70
CONTACT_DIST = 0.6            # two people are "close" if centre distance < this * mean body height
VIOLENCE_WEIGHTS = ["violence_openvino_model", "violence.pt", "violence.pth", "violence.h5", "violence.keras"]

ROUND_T = 2


def _center(box):
    return ((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0)


def _dist(a, b) -> float:
    return float(np.hypot(a[0] - b[0], a[1] - b[1]))


def _mean_kp_conf(person) -> float:
    confs = [k[2] for k in person.get("keypoints") or [] if len(k) > 2]
    return float(np.mean(confs)) if confs else 0.5


class Engine:
    def __init__(self, children: list[dict], zones: list[dict], analyzed_fps: float = 3.0):
        """Load the models once and set up tracking, smoothing and buffers."""
        self.analyzed_fps = float(analyzed_fps or 3.0)
        self.zones = list(zones or [])

        # children may come as dicts ({"id", "name", "age_group"}) or plain ids (live mode)
        self.children: list[dict] = []
        for c in children or []:
            c = {"id": str(c)} if not isinstance(c, dict) else dict(c)
            c["id"] = str(c["id"])
            self.children.append(c)
        self.auto_children = not self.children

        # models: loaded once, tracker and TV memory reset for this session
        perception.load_models()
        perception.reset_tracking()
        screens.reset_tv_memory()

        # P2 safety parts
        self._enabled = {"zone": bool(self.zones), "fall": True, "violence": False}
        self._errors: Counter = Counter()
        self._violence_model = self._load_violence_model()
        self._enabled["violence"] = self._violence_model is not None

        # history
        self.frames: list[dict] = []
        self.times: list[float] = []
        self.width = self.height = None

        self.track_to_child: dict[int, str] = {}
        self.child_tracks: dict[str, list[int]] = {c["id"]: [] for c in self.children}
        self.child_last: dict[str, dict] = {}          # child_id -> {"t", "box"}
        self._track_seen: Counter = Counter()
        self._tracks: dict[int, dict] = {}             # per-track buffers

        # per child, one sample per frame: (t, state or None)
        self.samples: dict[str, dict[str, list]] = {
            c["id"]: {"presence": [], "screen": [], "activity": [], "intake": []} for c in self.children
        }

        # events
        self.events: list[dict] = []
        self._open: dict[tuple, dict] = {}       # key -> {"event", "last_t"}
        self._pending: dict[tuple, dict] = {}    # key -> {"first_t", "last_t", "conf"}
        self._frame_buffer: deque = deque(maxlen=max(2, int(round(VIOLENCE_CLIP_S * self.analyzed_fps))))
        self._last_violence_t = -1e9
        self.report: dict | None = None
        self._last_objects: list[dict] = []

    # ------------------------------------------------------------------ setup
    def _load_violence_model(self):
        path = next((p for p in (perception.WEIGHTS_DIR / n for n in VIOLENCE_WEIGHTS) if p.exists()), None)
        if path is None:
            return None
        try:
            return violence_mod.load_model(str(path))
        except NotImplementedError:
            return None
        except Exception:
            log.exception("Could not load the violence model from %s", path)
            return None

    def _call_p2(self, feature: str, fn, *args):
        """Call a P2 function; switch the feature off while it is not implemented yet."""
        if not self._enabled.get(feature):
            return None
        try:
            return fn(*args)
        except NotImplementedError:
            self._enabled[feature] = False
            log.info("Safety check '%s' not implemented yet, skipped", feature)
        except Exception:
            self._errors[feature] += 1
            if self._errors[feature] <= 3:
                log.exception("Safety check '%s' failed on a frame", feature)
        return None

    def _add_child(self) -> str:
        n = len(self.children) + 1
        child = {"id": f"c{n}", "name": f"Child {n}", "age_group": None}
        while any(c["id"] == child["id"] for c in self.children):
            n += 1
            child = {"id": f"c{n}", "name": f"Child {n}", "age_group": None}
        self.children.append(child)
        self.child_tracks[child["id"]] = []
        self.samples[child["id"]] = {"presence": [], "screen": [], "activity": [], "intake": []}
        # earlier frames: this child was absent
        for t in self.times[:-1]:
            for cat in ("presence", "screen", "activity", "intake"):
                self.samples[child["id"]][cat].append((t, "absent" if cat == "presence" else None))
        return child["id"]

    # ---------------------------------------------------------- child matching
    def _match_children(self, people: list[dict], t: float) -> None:
        visible = {self.track_to_child[p["track_id"]] for p in people if p["track_id"] in self.track_to_child}
        for p in sorted(people, key=lambda q: q["track_id"]):
            tid = p["track_id"]
            if tid in self.track_to_child:
                continue
            self._track_seen[tid] += 1
            if self._track_seen[tid] < MIN_TRACK_FRAMES:
                continue

            free = [c["id"] for c in self.children if c["id"] not in visible]
            never_seen = [cid for cid in free if not self.child_tracks[cid]]
            chosen = None
            if never_seen:
                chosen = never_seen[0]                       # order of appearance
            else:
                # ByteTrack lost someone and gave them a new ID: re-link to the nearest lost child
                pc = _center(p["box"])
                best_d = None
                for cid in free:
                    last = self.child_last.get(cid)
                    if not last:
                        continue
                    d = _dist(pc, _center(last["box"]))
                    if d <= REID_MAX_DIST and (best_d is None or d < best_d):
                        chosen, best_d = cid, d
                if chosen is None and self.auto_children and len(self.children) < MAX_AUTO_CHILDREN:
                    chosen = self._add_child()
            if chosen is not None:
                self.track_to_child[tid] = chosen
                self.child_tracks[chosen].append(tid)
                visible.add(chosen)

    # --------------------------------------------------------------- activity
    def _track_buffers(self, tid: int) -> dict:
        if tid not in self._tracks:
            self._tracks[tid] = {"prev_kp": None, "prev_t": None, "scores": deque(),
                                 "history": deque(), "last_t": None,
                                 "intake": activity.IntakeWatcher()}
        return self._tracks[tid]

    def _activity(self, person: dict, t: float) -> str:
        buf = self._track_buffers(person["track_id"])
        if buf["prev_kp"] is not None:
            dt = t - buf["prev_t"]
            if 0 < dt <= MAX_MOVE_DT:
                score = activity.movement_score(buf["prev_kp"], person["keypoints"], person["box"]) / dt
                buf["scores"].append((t, score))
        buf["prev_kp"], buf["prev_t"] = person["keypoints"], t
        while buf["scores"] and buf["scores"][0][0] < t - ACTIVITY_AVG_S:
            buf["scores"].popleft()
        avg = float(np.mean([s for _, s in buf["scores"]])) if buf["scores"] else 0.0
        return activity.activity_state(avg)

    # ----------------------------------------------------------------- events
    def _new_event(self, key: tuple, info: dict) -> dict:
        etype, child_id = key[0], info["child_id"]
        event = {
            "id": f"e{len(self.events) + 1}",
            "child_id": child_id,
            "type": etype,
            "start_s": round(info["first_t"], ROUND_T),
            "end_s": round(info["last_t"], ROUND_T),
            "confidence": round(float(min(max(info["conf"], 0.0), 1.0)), 3),
            "zone_id": info.get("zone_id") if etype == "danger_zone" else None,
            "clip_url": None,
            "reviewed": False,
        }
        self.events.append(event)
        return event

    def _update_events(self, active: dict, t: float) -> list[dict]:
        """active: {key: {"child_id", "conf", "zone_id"?, "min_s"}} for this frame -> new alerts."""
        alerts = []
        for key, info in active.items():
            if key in self._open:
                o = self._open[key]
                o["last_t"] = t
                o["event"]["end_s"] = round(t, ROUND_T)
                o["event"]["confidence"] = round(max(o["event"]["confidence"], min(info["conf"], 1.0)), 3)
                continue
            pend = self._pending.setdefault(key, {**info, "first_t": t})
            pend["last_t"], pend["conf"] = t, max(pend["conf"], info["conf"])
            if t - pend["first_t"] >= info.get("min_s", 0.0):
                event = self._new_event(key, pend)
                self._open[key] = {"event": event, "last_t": t}
                del self._pending[key]
                alerts.append(dict(event))
        for key in [k for k in self._pending if k not in active]:
            if t - self._pending[key]["last_t"] > EVENT_GAP_S:
                del self._pending[key]
        for key in [k for k in self._open if k not in active]:
            if t - self._open[key]["last_t"] > EVENT_GAP_S:
                del self._open[key]
        return alerts

    def _safety(self, frame, people: list[dict], t: float) -> dict:
        active: dict = {}
        children_people = [p for p in people if p.get("child_id")]

        # danger zones (P2)
        for p in children_people:
            for zone in self.zones:
                if self._call_p2("zone", zones_mod.in_zone, p, zone):
                    ankles = [k[2] for k in p["keypoints"][15:17]]
                    zid = zone.get("id")
                    active[("danger_zone", p["child_id"], zid)] = {
                        "child_id": p["child_id"], "zone_id": zid, "min_s": ZONE_MIN_S,
                        "conf": float(np.mean(ankles)) if ankles else 0.5,
                    }

        # falls (P2): rules on the recent keypoint history of this person
        for p in children_people:
            history = list(self._tracks[p["track_id"]]["history"])
            if self._call_p2("fall", fall_mod.detect_fall, history):
                active[("fall", p["child_id"])] = {"child_id": p["child_id"], "conf": _mean_kp_conf(p)}

        # violent contact (P2): only when two people are close, and at most every VIOLENCE_EVERY_S
        if (self._enabled["violence"] and len(people) >= 2 and len(self._frame_buffer) == self._frame_buffer.maxlen
                and t - self._last_violence_t >= VIOLENCE_EVERY_S):
            close_pair = None
            for i in range(len(people)):
                for j in range(i + 1, len(people)):
                    a, b = people[i], people[j]
                    if not (a.get("child_id") or b.get("child_id")):
                        continue
                    if "active" not in (a.get("activity"), b.get("activity")):
                        continue  # nobody is moving fast: sitting or hugging is not rough play
                    h = ((a["box"][3] - a["box"][1]) + (b["box"][3] - b["box"][1])) / 2.0
                    if _dist(_center(a["box"]), _center(b["box"])) < CONTACT_DIST * max(h, 1e-3):
                        close_pair = (a, b)
                        break
                if close_pair:
                    break
            if close_pair:
                self._last_violence_t = t
                score = self._call_p2("violence", violence_mod.violent_contact_score,
                                      self._violence_model, list(self._frame_buffer))
                if score is not None:
                    a, b = close_pair
                    other = b if a.get("child_id") else a
                    flag_fn = getattr(violence_mod, "violence_flag", None)
                    if flag_fn is not None:
                        # P2's thresholds; anyone without a child_id is treated as an adult
                        flag = self._call_p2("violence", lambda: flag_fn(
                            self._violence_model, score,
                            child_involved=True, other_is_adult=not other.get("child_id")))
                    else:
                        flag = score >= VIOLENCE_THRESHOLD
                    if flag:
                        ids = sorted({p.get("child_id") for p in close_pair if p.get("child_id")})
                        active[("violent_contact", *ids)] = {"child_id": ids[0], "conf": float(score)}
        return active

    # ------------------------------------------------------------- per frame
    def process_frame(self, frame, t: float) -> dict:
        """Analyze one frame at time t (seconds).

        Returns one entry in the 'Frame overlays' format of docs/api.md,
        plus any new alerts: {"frame": {...}, "alerts": [...]}.
        """
        t = float(t)
        if frame is not None and self.width is None:
            self.height, self.width = frame.shape[:2]
        self.times.append(t)
        if self._enabled["violence"] and frame is not None:
            self._frame_buffer.append(frame)

        if (len(self.times) - 1) % OBJECTS_EVERY_N == 0 or frame is None:
            self._last_objects = perception.detect_objects(frame)
        objects = [dict(o) for o in self._last_objects]   # copies: "on" and holders are set per frame
        people = perception.detect_people(frame)

        # TVs on/off
        tvs = [o for o in objects if o["label"] == "tv"]
        for tv in tvs:
            tv["on"] = bool(screens.tv_is_on(frame, tv["box"]))
        tvs_on = [tv for tv in tvs if tv["on"]]

        # child matching + devices
        self._match_children(people, t)
        held = screens.assign_devices(people, objects)
        holder = {id(o): tid for tid, objs in held.items() for o in objs}

        out_people = []
        for p in people:
            tid = p["track_id"]
            p["child_id"] = self.track_to_child.get(tid)
            p["screen"] = screens.best_screen_state(p, held.get(tid, []), tvs_on)
            p["activity"] = self._activity(p, t)
            buf = self._tracks[tid]
            p["intake"] = buf["intake"].update(t, p["keypoints"], p["box"], objects)
            buf["last_t"] = t
            buf["history"].append({"t": t, "track_id": tid, "child_id": p["child_id"],
                                   "box": p["box"], "keypoints": p["keypoints"]})
            while buf["history"] and buf["history"][0]["t"] < t - FALL_HISTORY_S:
                buf["history"].popleft()
            if p["child_id"]:
                self.child_last[p["child_id"]] = {"t": t, "box": p["box"]}
            out_people.append({
                "track_id": tid, "child_id": p["child_id"], "box": p["box"],
                "keypoints": p["keypoints"], "screen": p["screen"], "activity": p["activity"],
                "intake": p["intake"],
            })

        # per-child samples (one per frame, so segments cover exactly the present time)
        by_child = {p["child_id"]: p for p in people if p["child_id"]}
        for cid, s in self.samples.items():
            p = by_child.get(cid)
            s["presence"].append((t, "present" if p else "absent"))
            s["screen"].append((t, p["screen"] if p else None))
            s["activity"].append((t, p["activity"] if p else None))
            s["intake"].append((t, p["intake"] if p else None))

        alerts = self._update_events(self._safety(frame, people, t), t)

        # forget tracks not seen for a while (keeps memory flat in live mode)
        for tid in [k for k, b in self._tracks.items() if b["last_t"] is not None and t - b["last_t"] > TRACK_FORGET_S]:
            del self._tracks[tid]

        out_objects = []
        for o in objects:
            item = {"label": o["label"], "box": o["box"]}
            if o["label"] == "tv":
                item["on"] = o["on"]
            elif o["label"] in screens.HANDHELD_LABELS:
                item["held_by"] = holder.get(id(o))
            out_objects.append(item)

        frame_out = {"t": round(t, ROUND_T), "people": out_people, "objects": out_objects}
        self.frames.append(frame_out)
        return {"frame": frame_out, "alerts": alerts}

    # ------------------------------------------------------------------ finish
    def _frame_dt(self) -> float:
        diffs = sorted(b - a for a, b in zip(self.times, self.times[1:]) if b > a)
        return diffs[len(diffs) // 2] if diffs else 1.0 / self.analyzed_fps

    def _segments(self, duration: float) -> list[dict]:
        segments = []
        for child in self.children:
            cid = child["id"]
            s = self.samples[cid]
            presence = smoothing.smooth(s["presence"], PRESENCE_WINDOW_S)
            if presence:
                presence[-1]["end_s"] = round(max(presence[-1]["end_s"], duration), ROUND_T)
            for seg in presence:
                segments.append({"child_id": cid, "category": "presence", **seg})

            for seg in (x for x in presence if x["state"] == "present"):
                a, b = seg["start_s"], seg["end_s"]
                for category, window in (("screen", SCREEN_WINDOW_S), ("activity", ACTIVITY_WINDOW_S),
                                         ("intake", INTAKE_WINDOW_S)):
                    window_samples = [(t, st) for t, st in s[category] if a - 1e-6 <= t < b - 1e-6]
                    default = {"screen": "none", "activity": "still", "intake": "none"}[category]
                    window_samples = self._fill_missing(window_samples, default)
                    parts = smoothing.smooth(window_samples, window)
                    if not parts:
                        continue
                    parts[0]["start_s"] = a
                    parts[-1]["end_s"] = b
                    for part in parts:
                        part["start_s"] = max(part["start_s"], a)
                        part["end_s"] = min(part["end_s"], b)
                        if part["end_s"] > part["start_s"]:
                            segments.append({"child_id": cid, "category": category, **part})
        return segments

    @staticmethod
    def _fill_missing(samples: list[tuple], default: str) -> list[tuple]:
        """Short detection drop-outs inside a present period: carry the last known state."""
        known = next((st for _, st in samples if st is not None), default)
        out = []
        for t, st in samples:
            if st is None:
                st = known
            known = st
            out.append((t, st))
        return out

    def _fallback_report(self, session: dict, children: list[dict], segments: list[dict], events: list[dict]) -> dict:
        """Used only while report.build_report (P4) is not implemented yet."""
        totals = {}
        for c in children:
            cid = c["id"]
            t = {k: 0.0 for k in ("tv_s", "tablet_s", "phone_s", "multi_screen_s", "none_s",
                                  "active_s", "light_s", "still_s", "present_s")}
            child_segs = [s for s in segments if s["child_id"] == cid]
            for seg in child_segs:
                if seg["category"] not in ("screen", "activity", "presence"):
                    continue  # intake 'none' must not be added to the screen 'none_s'
                key = f"{seg['state']}_s"
                if key in t:
                    t[key] += seg["end_s"] - seg["start_s"]
            stills = [s for s in child_segs if s["category"] == "activity" and s["state"] == "still"]
            longest = None
            if stills:
                ls = max(stills, key=lambda s: s["end_s"] - s["start_s"])
                overlap: Counter = Counter()
                for s in child_segs:
                    if s["category"] == "screen":
                        o = min(s["end_s"], ls["end_s"]) - max(s["start_s"], ls["start_s"])
                        if o > 0:
                            overlap[s["state"]] += o
                longest = {"duration_s": round(ls["end_s"] - ls["start_s"], ROUND_T), "start_s": ls["start_s"],
                           "during": overlap.most_common(1)[0][0] if overlap else "none"}
            totals[cid] = {k: round(v, ROUND_T) for k, v in t.items()}
            totals[cid]["longest_still"] = longest
        return {
            "id": session.get("id"),
            "date": session.get("date"),
            "started_at": session.get("started_at"),
            "video": {"url": None, "duration_s": session["duration_s"], "width": session["width"],
                      "height": session["height"], "analyzed_fps": session["analyzed_fps"]},
            "children": children,
            "segments": segments,
            "totals": totals,
            "events": events,
        }

    def finish(self) -> dict:
        """Close the session and return the full 'Session report' (docs/api.md)."""
        duration = round(self.times[-1] + self._frame_dt(), ROUND_T) if self.times else 0.0
        segments = self._segments(duration)

        self._open.clear()
        self._pending.clear()
        events = [dict(e) for e in self.events]

        children = []
        for c in self.children:
            child = {"id": c["id"], "name": c.get("name"), "age_group": c.get("age_group"),
                     "track_ids": list(self.child_tracks.get(c["id"], []))}
            children.append(child)

        session = {
            "id": None,
            "date": date.today().isoformat(),
            "started_at": None,
            "duration_s": duration,
            "width": self.width,
            "height": self.height,
            "analyzed_fps": self.analyzed_fps,
            "frames_analyzed": len(self.times),
            "video": {"url": None, "duration_s": duration, "width": self.width,
                      "height": self.height, "analyzed_fps": self.analyzed_fps},
        }
        try:
            self.report = report_mod.build_report(session, children, segments, events)
        except NotImplementedError:
            self.report = self._fallback_report(session, children, segments, events)
        return self.report

    def get_frames(self) -> dict:
        """All overlays so far, in the 'Frame overlays' format (GET /sessions/{id}/frames)."""
        return {"analyzed_fps": self.analyzed_fps, "frames": self.frames}
