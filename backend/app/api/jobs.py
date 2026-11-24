"""Upload + processing screens: POST /analyze and GET /jobs/{id}.

process_video runs the real pipeline (app/pipeline/run.py) and saves the report.
"""
import shutil
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session as DbSession

from app.config import settings
from app.db.models import Child, Event, Job, Segment, Session, Zone, new_id
from app.db.session import SessionLocal, get_db
from app.pipeline.run import run_video

router = APIRouter(tags=["analyze"])

SEGMENT_FIELDS = ("child_id", "category", "state", "start_s", "end_s")


def process_video(job_id: str, video_path: str, session_date: date) -> None:
    db = SessionLocal()
    job = db.get(Job, job_id)
    try:
        job.status = "processing"
        db.commit()

        # Children and zones from the setup screen, in the shape the Engine expects
        children = [{"id": c.id, "name": c.name, "age_group": c.age_group} for c in db.query(Child).all()]
        zones = [{"id": z.id, "name": z.name, "polygon": z.polygon} for z in db.query(Zone).all()]
        known = {c["id"] for c in children}

        # Moves the processing screen; writes to the database only when the percent changes
        last = {"p": -1}

        def on_progress(percent: int, step: str) -> None:
            if percent != last["p"]:
                last["p"] = percent
                job.progress, job.step = percent, step
                db.commit()

        # Creates the session row first, so the frames file can use its id
        session = Session(date=session_date, source="upload")
        db.add(session)
        db.flush()
        frames_path = settings.storage_dir / "frames" / f"{session.id}.json"

        report = run_video(video_path, children, zones, on_progress, frames_path=str(frames_path))

        # Fills the duration now that the video has been read
        session.duration_s = (report.get("video") or {}).get("duration_s") or 0
        report["id"] = session.id
        report["date"] = session_date.isoformat()

        # Event ids must be unique across all sessions (the Engine numbers them e1, e2... per video)
        for e in report["events"]:
            e["id"] = new_id("e")

        # Saves segments and events in their own tables (used by the dashboard summaries)
        for s in report["segments"]:
            if s["child_id"] in known:
                db.add(Segment(session_id=session.id, **{k: s[k] for k in SEGMENT_FIELDS}))
        for e in report["events"]:
            db.add(Event(
                id=e["id"], session_id=session.id,
                child_id=e["child_id"] if e["child_id"] in known else None,
                type=e["type"], start_s=e["start_s"], end_s=e["end_s"],
                confidence=e["confidence"], zone_id=e.get("zone_id"),
                clip_url=e.get("clip_url"), reviewed=False,
            ))

        session.report = report
        job.status, job.progress, job.step, job.session_id = "done", 100, "Done", session.id
        db.commit()
    except Exception as exc:  # report the failure to the frontend instead of hanging
        db.rollback()
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
