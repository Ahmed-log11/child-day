"""Upload + processing screens: POST /analyze and GET /jobs/{id}.

For now the background task only simulates progress and points to the mock session.
P4 replaces `process_video` with a call to the real pipeline (app/pipeline/run.py).
"""
import shutil
import time
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session as DbSession

from app.config import settings
from app.db.models import Job
from app.db.session import SessionLocal, get_db

router = APIRouter(tags=["analyze"])

MOCK_STEPS = ["Detecting people", "Tracking children", "Analyzing screens", "Checking safety", "Building report"]


def process_video(job_id: str, video_path: str, session_date: date) -> None:
    db = SessionLocal()
    job = db.get(Job, job_id)
    try:
        job.status = "processing"
        for i, step in enumerate(MOCK_STEPS):
            job.step, job.progress = step, int(i / len(MOCK_STEPS) * 100)
            db.commit()
            time.sleep(1)  # stands in for the real work
        job.status, job.progress, job.step, job.session_id = "done", 100, "Done", "s1"
        db.commit()
    except Exception as exc:  # report the failure to the frontend instead of hanging
        job.status, job.error = "failed", str(exc)
        db.commit()
    finally:
        db.close()


@router.post("/analyze")
def analyze(
    background: BackgroundTasks,
    video: UploadFile = File(...),
    session_date: date | None = Form(None),
    db: DbSession = Depends(get_db),
):
    if not (video.content_type or "").startswith("video/"):
        raise HTTPException(422, "Please upload a video file")
    job = Job()
    db.add(job)
    db.commit()

    uploads = settings.storage_dir / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    path = uploads / f"{job.id}_{video.filename}"
    with path.open("wb") as f:
        shutil.copyfileobj(video.file, f)

    background.add_task(process_video, job.id, str(path), session_date or date.today())
    return {"job_id": job.id}


@router.get("/jobs/{job_id}")
def get_job(job_id: str, db: DbSession = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return {
        "job_id": job.id, "status": job.status, "progress": job.progress,
        "step": job.step, "session_id": job.session_id, "error": job.error,
    }
