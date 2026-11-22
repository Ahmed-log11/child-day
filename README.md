# Child Day

A computer vision platform that turns a home camera feed into a clear picture of a child's day: screen time across every screen (TV, tablet, phone, and more than one at once), how much they moved, and safety alerts for falls, danger zones and violent contact. Everything in one dashboard for the parents.

In this project the input is an uploaded video. In production it would be a live camera feed.

**Live demo:** _link after deployment_

## How it works

```
Video → YOLO11 detect + pose + tracking → per-second states → smoothing → report → dashboard
```

| Part | Approach |
|---|---|
| People, TV, phone, cup | YOLO11 (pretrained) |
| Tablet | YOLO11 fine-tuned |
| Body keypoints | YOLO11-pose (pretrained) |
| Tracking each child | ByteTrack |
| Screen state, movement, danger zones | Rules on detections and keypoints |
| Falls | Rules on keypoints |
| Violent contact | Classifier trained on RWF-2000 |

## Repository

| Folder | What's in it |
|---|---|
| `docs/` | API contract (`api.md`) and architecture notes |
| `backend/` | FastAPI app, the CV pipeline, database, Dockerfile |
| `frontend/` | React + Vite + Tailwind app |
| `training/` | Colab notebooks for the models we train |
| `evaluation/` | Notebooks and ground truth for our results |
| `demo/` | The script for the demo video |

## Team workflow

- Never push to `main`. Work on a branch and open a pull request.
- The API format lives in `docs/api.md`. If it changes, update `frontend/src/mocks/` in the same pull request.
- Datasets, videos, model weights and `.env` are never committed.

## Start here

1. Read `docs/api.md`. Every part of the project follows it.
2. Find your files in the table below. Each function says what it takes, what it returns, and who owns it.
3. Prototype in a notebook if you like, then move the working code into your `.py` file.

## Team

| Who | Owns | Files |
|---|---|---|
| P1 | Perception: detection, pose, tracking, screen state, movement, smoothing | `backend/app/pipeline/perception.py`, `screens.py`, `activity.py`, `smoothing.py`, `engine.py` |
| P2 | Safety: violent contact, falls, danger zones | `pipeline/violence.py`, `fall.py`, `zones.py`, `training/02_violence_classifier.ipynb` |
| P4 | Data and proof: tablet model, demo video, ground truth, evaluation, report, seed data | `pipeline/run.py`, `report.py`, `app/seed.py`, `app/storage.py`, `training/01_tablet_finetune.ipynb`, `evaluation/`, `demo/` |
| Ahmed | Frontend, integration, deployment, reviews every pull request | `frontend/`, `docs/` |

## Running locally

Everything, with Docker:

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs

Without Docker:

```bash
# backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload        # http://localhost:8000/docs
pytest                               # run the tests

# frontend (in a second terminal)
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

The frontend uses the mock data in `frontend/src/mocks/` by default, so it works without the backend. Set `VITE_USE_MOCKS=false` to use the real API.

Deployment steps are in `docs/deployment.md`.

## Privacy

The system stores timelines and short alert clips, never the full video. It reports what happened, not judgments about the child. Alerts are for a parent to review, not verdicts.
