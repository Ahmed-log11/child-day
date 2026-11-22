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

## Running locally

_Coming in the next step (Docker Compose)._

## Privacy

The system stores timelines and short alert clips, never the full video. It reports what happened, not judgments about the child. Alerts are for a parent to review, not verdicts.
