# P1: Perception

> **Using Claude or another AI?** Give it this file, `docs/api.md` and the files listed under "Your files". Tell it: "I own these files in a FastAPI computer vision project. Help me implement them without changing the function names, inputs or outputs."

## The project in one paragraph

Child Day turns a home video into a picture of a child's day: screen time on TV, tablet and phone (and more than one at once), how much they moved, and safety moments for a parent to review (falls, danger zones, rough contact). It's a FastAPI backend (Docker, Hugging Face Space) and a React frontend (Vercel). Your part is the core: everything the system *sees*.

## What you own

You turn each video frame into: who is there, where their body is, which screen they're using, and how much they're moving. You also own the `Engine`, the class that runs all the steps for every frame.

**Your files** (all in `backend/app/pipeline/`):

| File | Function | What it does |
|---|---|---|
| `perception.py` | `detect_objects(frame)` | YOLO11n (pretrained, COCO): TV, phone, cup... Plus P4's tablet model. Returns `[{"label", "box", "confidence"}]` |
| | `detect_people(frame)` | YOLO11n-pose + ByteTrack. Returns `[{"track_id", "box", "keypoints"}]` with 17 COCO keypoints `[x, y, conf]` |
| `screens.py` | `assign_devices(people, objects)` | Phone/tablet goes to the person whose wrist is closest (and close enough). Returns `{track_id: [objects]}` |
| | `tv_is_on(frame, tv_box)` | Brightness and change inside the TV box |
| | `head_direction(keypoints)` | `toward_tv`, `down` or `other` from nose, eyes, ears |
| | `screen_state(person, devices, tv)` | `tv`, `tablet`, `phone`, `multi_screen` or `none` |
| `activity.py` | `movement_score(prev_keypoints, keypoints, box)` | Keypoint motion between frames, divided by body size |
| | `activity_state(score)` | `active`, `light` or `still` |
| `smoothing.py` | `smooth(states, window_s=10)` | `[(t, state)]` → `[{"state", "start_s", "end_s"}]` without flicker |
| `engine.py` | `Engine.__init__`, `process_frame`, `finish` | Loads models once, runs every step per frame, keeps history, returns the report at the end |

## The output you must produce

`Engine.process_frame(frame, t)` returns one frame in the **Frame overlays** format of `docs/api.md`, plus new alerts:

```json
{
  "frame": {
    "t": 12.33,
    "people": [{"track_id": 1, "child_id": "c1", "box": [0.31, 0.22, 0.52, 0.88],
                "keypoints": [[0.41, 0.27, 0.98], "...17 points"], "screen": "tv", "activity": "still"}],
    "objects": [{"label": "tv", "box": [0.02, 0.10, 0.28, 0.45], "on": true},
                {"label": "tablet", "box": [0.40, 0.55, 0.47, 0.63], "held_by": 1}]
  },
  "alerts": []
}
```

`Engine.finish()` returns the **Session report** (P4's `report.build_report` builds it from your segments and P2's events).

Important rules from the contract:
- Boxes and keypoints are **normalized 0–1**. YOLO gives pixels, so divide by width and height (`result.boxes.xyxyn` already does it).
- `multi_screen` is its own state. That time is **not** also counted as `tv` or `tablet`.
- Segments for one child and one category never overlap.

## Tips

- Load models **once** in `Engine.__init__`, never per frame.
- Tracking: `model.track(frame, persist=True, tracker="bytetrack.yaml")` keeps the same `track_id` across frames. Matching `track_id` to a child (`child_id`) can be simple for the demo: the order they appear, or which is taller.
- COCO has no tablet. Until P4's model is ready, treat a big "cell phone" box as a tablet, or just use phone.
- Use `imgsz=480` or `416` and 3 fps. It has to run on a free CPU.
- Put thresholds (wrist distance, movement cut-offs, smoothing window) at the top of each file as constants, so tuning is easy.
- Head direction doesn't need to be perfect. Combined with "the TV is on and in front of them", it's enough.

## Who you depend on, and who depends on you

- **P4** gives you: the tablet weights and a quick test video. Until then, use any video from the internet with people, a TV and a phone.
- **P2** plugs safety into your Engine. Agree with them first: their functions get the `people` list (with keypoints and track_id) you already have.
- **P4** uses your segments to build the report and to evaluate accuracy.
- **Ahmed** draws your `frame` output on the video, so the shape must match the contract exactly.

## Order of work

1. `detect_objects` and `detect_people` working on a test video
2. Screens and movement functions
3. `smoothing` and the `Engine` running a full video; plug in P2's functions
4. Tune thresholds on the demo video; OpenVINO export for speed

**Done means:** you can run a 10-minute video through `Engine` on a CPU in a few minutes, and the timeline looks right when you compare it with the video.

## Rules for everyone

- Never push to `main`. Make a branch (`p1-screens`, `p2-violence`...), push it, open a pull request. Ahmed reviews and merges.
- Never commit datasets, videos, model weights (`.pt`, `.onnx`, OpenVINO folders) or `.env`. The `.gitignore` already blocks most of them. Share weights through Google Drive or a Hugging Face model repo.
- Follow `docs/api.md` exactly: times in seconds, boxes and keypoints normalized 0–1 as `[x1, y1, x2, y2]`, the exact state names (`tv`, `tablet`, `phone`, `multi_screen`, `none`, `active`, `light`, `still`, `fall`, `danger_zone`, `violent_contact`). If you need to change a shape, tell Ahmed first.
- Don't rename functions or change their inputs/outputs without telling the team. Other people's code calls them.
- Prototype in a notebook if you like. When it works, move the code into your `.py` file. The server only runs the `.py` files.
- Any new Python library you use goes in `backend/requirements.txt`, or the server build fails.
- Anything merged into `main` that touches `backend/` is tested and deployed to the live server automatically. Only open a PR when your code runs and `python -m pytest` passes.
- Everyone in the demo video agreed to be filmed. No real children's footage in the repo or anything public.

## How the backend fits together

```
Upload in React
  → backend/app/api/jobs.py         receives the video          (Ahmed)
  → backend/app/pipeline/run.py     reads frames at 3 fps       (P4)
  → backend/app/pipeline/engine.py  for each frame calls:       (P1)
        perception.py   YOLO detect + pose + ByteTrack          (P1)
        screens.py      who is on which screen                  (P1)
        activity.py     how much each child moves               (P1)
        zones.py / fall.py / violence.py   safety               (P2)
        smoothing.py    clean timeline                          (P1)
  → backend/app/pipeline/report.py  builds the report JSON       (P4)
  → database (Ahmed) → React dashboard (Ahmed)
```

The same `Engine` is used for live webcam mode later, so it must work frame by frame and never need the whole video at once.

## Running it

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload     # API docs at http://localhost:8000/docs
python -m pytest                  # tests must still pass before you open a PR
```

