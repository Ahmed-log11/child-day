# P4: Data and proof

> **Using Claude or another AI?** Give it this file, `docs/api.md` and the files listed under "Your files". Tell it: "I own these files in a FastAPI computer vision project. Help me implement them without changing the function names, inputs or outputs."

## The project in one paragraph

Child Day turns a home video into a picture of a child's day: screen time on TV, tablet and phone, how much they moved, and safety moments for a parent to review. It's a FastAPI backend (Docker, Hugging Face Space) and a React frontend (Vercel). Your part makes it real and proves it works: the data, the demo video, the numbers, and the glue that turns a video into a report.

## Do these first: the team is waiting on them

1. **A quick test video, as soon as possible.** Phone camera, one person, a few minutes: watch TV, pick up a phone, a tablet, walk around. It doesn't need to be good. P1 and P2 need *something* from our camera angle to test on.
2. **Tablet data.** COCO has no tablet class, so P1 can't detect tablets until your model is ready.

## What you own

| File | What it does |
|---|---|
| `training/01_tablet_finetune.ipynb` | Fine-tune YOLO11n to detect tablets |
| `demo/scenario_script.md` | The scene list for the final demo video (already written; adjust it) |
| `evaluation/ground_truth/test_video.csv` | Stopwatch log of what really happens in the demo video |
| `evaluation/01_evaluate_timeline.ipynb` | Compare our timeline with the ground truth |
| `evaluation/02_evaluate_safety.ipynb` | Safety numbers, with P2 |
| `backend/app/pipeline/run.py` | `run_video(video_path, children, zones, on_progress)`: read the video at 3 fps, feed each frame to the Engine, return the report |
| `backend/app/pipeline/report.py` | `build_report(...)`: totals per child, longest still period, in the Session report format |
| `backend/app/storage.py` | `save_clip(local_path, name)`: save a short alert clip, return its URL |
| `backend/app/seed.py` | Demo household: two children and a few weeks of history marked `is_demo_data=True` |
| The presentation | With the team |

## 1. Tablet fine-tune

- Get a tablet dataset from Roboflow Universe (search "tablet" or "ipad"), export in **YOLO format**. Add 30–50 photos of our own tablet from the demo room if you can.
- Train only the tablet class: `YOLO("yolo11n.pt").train(data="data.yaml", epochs=50, imgsz=640)`.
- The system runs **two detectors**: the original YOLO for everything else and yours for tablets. So you don't need TV/phone labels.
- Report mAP50, precision and recall on the test split. Export to OpenVINO, share the weights on Drive / a Hugging Face model repo. Never commit them.

## 2. The demo video and ground truth

- Follow `demo/scenario_script.md`: TV, TV + tablet together, play, phone, kitchen zone, a staged fall onto a cushion, a slow staged push (no real contact), a hug that should not alert, a long still period.
- 10–15 minutes, one take, fixed camera, good light, the whole room in view (including the floor, for falls and zones).
- Everyone in it must agree. No real children unless parents agree in writing, and then never in the repo or anything public.
- While watching it back, log every state change in `evaluation/ground_truth/test_video.csv`:
  ```csv
  child,category,state,start_s,end_s
  c1,screen,tv,0,210
  ```
  Same state names as `docs/api.md`.

## 3. Evaluation

- **Timeline:** for each state (tv, tablet, phone, multi_screen, active, light, still), compare our minutes with the ground truth. Show the error per state and a timeline image of "ours vs real". This is the slide that proves the system works.
- **Safety:** with P2, precision / recall / F1 per alert type, on public data and on our staged clips.

## 4. The glue

- **`run.py`**: open the video with OpenCV, keep 1 frame every `fps / 3`, call `engine.process_frame(frame, t)` with `t` in seconds, call `on_progress(percent, step)` now and then, and return `engine.finish()`. Ahmed connects it to the upload endpoint.
- **`report.py`**: from segments and events, compute each child's totals (`tv_s`, `tablet_s`..., `active_s`...) and the longest still period. Output must match the **Session report** in `docs/api.md` exactly. Remember: `multi_screen` time is not also counted as `tv` or `tablet`.
- **`storage.py`**: cut 5 seconds before to 5 seconds after an event, save it locally (or to Supabase Storage when configured), return the URL.
- **`seed.py`**: create Sara and Omar, the pre-analyzed demo session, and about 3 weeks of believable generated days with `is_demo_data=True`. Ask Ahmed for the table names (`backend/app/db/models.py`).

## Who you depend on, and who depends on you

- **P1** needs your test video and tablet weights first.
- **P2** needs the staged scenes in the demo video.
- **Ahmed** needs `run.py` and `report.py` to connect the upload, and `seed.py` for the dashboard history.

## Order of work

1. Quick test video and tablet model (others are waiting on these)
2. `run.py` and `report.py`
3. Final demo video and ground truth CSV
4. Evaluation notebooks, `seed.py`, `storage.py`
5. Presentation

**Done means:** the demo video goes in, a correct report comes out, and the presentation has real accuracy numbers against our own ground truth.

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

