# P2: Safety

> **Using Claude or another AI?** Give it this file, `docs/api.md` and the files listed under "Your files". Tell it: "I own these files in a FastAPI computer vision project. Help me implement them without changing the function names, inputs or outputs."

## The project in one paragraph

Child Day turns a home video into a picture of a child's day: screen time on TV, tablet and phone, how much they moved, and safety moments for a parent to review. It's a FastAPI backend (Docker, Hugging Face Space) and a React frontend (Vercel). Your part is safety: the moments a parent should look at.

**Important tone:** we never say "your child was hit" or "your child fell". We flag a moment and show the clip. The parent decides. So we prefer fewer, confident alerts over many false ones.

## What you own

Three kinds of events: `violent_contact`, `fall` and `danger_zone`. You also train the only model built from scratch in the project.

**Your files:**

| File | Function | What it does |
|---|---|---|
| `training/02_violence_classifier.ipynb` | (notebook) | Train MobileNetV2 + LSTM on RWF-2000, evaluate, export `violence.pt` |
| `backend/app/pipeline/violence.py` | `load_model(weights_path)` | Load the trained model once |
| | `violent_contact_score(model, clip_frames)` | Probability 0–1 that a 2–3 second clip shows violent contact |
| `backend/app/pipeline/fall.py` | `detect_fall(history)` | Rules on keypoints: hips drop fast, body goes horizontal, stays down a few seconds |
| `backend/app/pipeline/zones.py` | `in_zone(person, zone)` | True if the person's feet (ankle keypoints) are inside the zone polygon |

## The violence classifier

- **Data:** RWF-2000 (2,000 clips, fight / no fight). Sample 16 frames per clip, resize to 224.
- **Model:** MobileNetV2 pretrained on ImageNet and **frozen**, run on each frame to get a feature vector → LSTM over the 16 vectors → one probability. Only the LSTM and the last layer train, so it's fast on Colab.
- **Evaluate:** accuracy, precision, recall, F1 and the confusion matrix on the validation split.
- **Test on our own clips:** the team films a few staged scenes: a slow push (no real contact), a hug, a high five, normal play. A hug should **not** score high. Put these results in the notebook; they matter more to the audience than the RWF-2000 numbers.
- **Export:** save the weights as `violence.pt` and share them on Drive or a Hugging Face model repo. Never commit them.
- **Speed:** only run the model when two tracked people are close together (boxes overlap or near each other). That's the Engine's job, but agree on it with P1.

## Falls and zones (rules, no training)

- **Fall:** use the hips and shoulders keypoints over the last 2–3 seconds (about 6–9 frames at 3 fps). A fall = the hip height drops fast, then the body is wider than tall (shoulders and hips nearly level), then it stays down for a few seconds. Test it on a few UR Fall clips and the staged fall in our demo video. Write precision and recall in the evaluation notebook.
- **Zone:** a zone is a polygon of normalized `[x, y]` points (see `docs/api.md`). Use the ankle keypoints (15, 16), or the bottom middle of the box if the ankles aren't visible. `cv2.pointPolygonTest` or a simple ray-casting check is enough. Only raise an event if the child stays inside for a couple of seconds.

## The output you must produce

Each event follows the `events` format in `docs/api.md`:

```json
{ "id": "e1", "child_id": "c1", "type": "danger_zone", "start_s": 512, "end_s": 530,
  "confidence": 0.91, "zone_id": "z1", "clip_url": null, "reviewed": false }
```

- `confidence` is 0–1. For rule-based events, use a simple fixed value or how strongly the rule matched.
- `zone_id` only for `danger_zone`.
- `clip_url` is filled later by P4's `storage.save_clip`.
- One real moment = **one** event with a start and end, not one event per frame. Merge consecutive frames.

## Who you depend on, and who depends on you

- **P1** gives you the people with `track_id` and keypoints each frame. Your functions take that list as it is. Agree first with P1 how the Engine will call you.
- **P4** films the staged scenes in the demo video and writes `evaluation/02_evaluate_safety.ipynb` with you.
- **Ahmed** shows your events as alerts with their clips.

## Order of work

1. Start training the violence classifier first, it takes the longest
2. `in_zone` and the fall rules
3. `violence.py` loading the model; plug everything into P1's Engine
4. Test on our staged clips, tune thresholds, evaluation numbers

**Done means:** on the demo video, the push, the fall and the kitchen visit each give exactly one event at the right time, and the hug gives none.

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

