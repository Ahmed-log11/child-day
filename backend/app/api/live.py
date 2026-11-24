"""Live mode: webcam frames arrive over a WebSocket and the Engine analyzes them one by one.

Only the newest frame is analyzed: if the server is slower than the camera, older frames
are dropped, so the overlay never lags behind. Stop turns the live session into a normal
saved session. With USE_MOCK_PIPELINE=true (tests) the socket echoes empty overlays.
"""
import asyncio
import base64
import threading
from datetime import date

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.config import settings
from app.db.models import Child, Zone, new_id
from app.db.session import get_db
from app.reports import save_report

router = APIRouter(tags=["live"])

LIVE_FPS = 2.5            # the frontend sends a frame every 400 ms
_live: dict[str, dict] = {}   # session_id -> {"engine", "lock", "date"}


class LiveStart(BaseModel):
    children: list[str] = []


def _decode(image_b64: str):
    import cv2
    import numpy as np

    if not image_b64:
        return None
    data = np.frombuffer(base64.b64decode(image_b64), np.uint8)
    return cv2.imdecode(data, cv2.IMREAD_COLOR)


def _analyze(live: dict, image_b64: str, t: float) -> dict | None:
    frame = _decode(image_b64)
    if frame is None:
        return None
    with live["lock"]:
        return live["engine"].process_frame(frame, t)


@router.post("/live/start")
def live_start(body: LiveStart, db: DbSession = Depends(get_db)):
    session_id = new_id("live")
    if settings.use_mock_pipeline:
        return {"session_id": session_id}

    from app.pipeline.engine import Engine

    rows = db.scalars(select(Child)).all()
    if body.children:
        rows = [c for c in rows if c.id in body.children]
    children = [{"id": c.id, "name": c.name, "age_group": c.age_group} for c in rows]
    zones = [{"id": z.id, "name": z.name, "polygon": z.polygon} for z in db.scalars(select(Zone))]
    _live[session_id] = {"engine": Engine(children, zones, analyzed_fps=LIVE_FPS),
                         "lock": threading.Lock(), "date": date.today()}
    return {"session_id": session_id}


async def _echo(ws: WebSocket) -> None:
    while True:
        msg = await ws.receive_json()  # {"t": 12.33, "image": "<base64 JPEG>"}
        await ws.send_json({"frame": {"t": msg.get("t", 0), "people": [], "objects": []}, "alerts": []})


async def _analyze_latest(ws: WebSocket, live: dict) -> None:
    latest: dict = {}
    arrived = asyncio.Event()

    async def receive() -> None:
        while True:
            latest["msg"] = await ws.receive_json()
            arrived.set()

    receiver = asyncio.create_task(receive())
    try:
        while True:
            waiter = asyncio.create_task(arrived.wait())
            done, _ = await asyncio.wait({receiver, waiter}, return_when=asyncio.FIRST_COMPLETED)
            if receiver in done:          # the browser disconnected
                waiter.cancel()
                receiver.result()         # re-raises WebSocketDisconnect
            arrived.clear()
            msg = latest["msg"]
            result = await run_in_threadpool(_analyze, live, msg.get("image", ""), float(msg.get("t", 0)))
            if result is not None:
                await ws.send_json(result)
    finally:
        receiver.cancel()


@router.websocket("/live/{session_id}")
async def live_stream(ws: WebSocket, session_id: str):
    await ws.accept()
    live = _live.get(session_id)
    try:
        if live is None:
            await _echo(ws)
        else:
            await _analyze_latest(ws, live)
    except WebSocketDisconnect:
        pass


@router.post("/live/{session_id}/stop")
def live_stop(session_id: str, db: DbSession = Depends(get_db)):
    live = _live.pop(session_id, None)
    if live is None:
        return {"session_id": session_id}
    with live["lock"]:
        engine = live["engine"]
        if not engine.times:      # stopped before any frame was analyzed
            return {"session_id": session_id}
        report = engine.finish()
        frames = engine.get_frames()
    row = save_report(db, report, frames, source="live", session_date=live["date"])
    return {"session_id": row.id}
