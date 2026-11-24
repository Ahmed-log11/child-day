"""Upload + processing screens: POST /analyze and GET /jobs/{id}.

The background task runs the real pipeline (app/pipeline/run.py) and saves the report.
With USE_MOCK_PIPELINE=true (the default, used by the tests) it only simulates progress
and points to the mock session.
"""
import shutil
from pathlib import Path
import time
from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.config import settings
from app.db.models import Child, Job, Zone
from app.db.session import SessionLocal, get_db
from app.reports import save_report

router = APIRouter(tags=["analyze"])

MOCK_STEPS = ["Detecting people", "Tracking children", "Analyzing screens", "Checking safety", "Building report"]


def _mock_run(db, job) -> str:
    for i, step in enumerate(MOCK_STEPS):
        job.step, job.progress = step, int(i / len(MOCK_STEPS) * 100)
        db.commit()
        time.sleep(1)  # stands in for the real work
    return "s1"


def _real_run(db, job, video_path: str, session_date: date) -> str:
    from app.pipeline.run import run_video  # loads the models only when really needed

    children = [{"id": c.id, "name": c.name, "age_group": c.age_group} for c in db.scalars(select(Child))]
    zones = [{"id": z.id, "name": z.name, "polygon": z.polygon} for z in db.scalars(select(Zone))]

    def on_progress(percent: int, step: str) -> None:
        job.progress, job.step = int(percent), step
        db.commit()

    report, frames = run_video(video_path, children, zones, on_progress, return_frames=True)
    video_url = f"/media/uploads/{quote(Path(video_path).name)}"
    row = save_report(db, report, frames, source="upload", session_date=session_date, video_url=video_url)
    return row.id


def process_video(job_id: str, video_path: str, session_date: date) -> None:
    db = SessionLocal()
    job = db.get(Job, job_id)
    try:
        job.status = "processing"
        db.commit()
        if settings.use_mock_pipeline:
            session_id = _mock_run(db, job)
        else:
            session_id = _real_run(db, job, video_path, session_date)
        job.status, job.progress, job.step, job.session_id = "done", 100, "Done", session_id
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
