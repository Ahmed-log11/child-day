"""Live mode (phase 2). The WebSocket echoes mock overlays for now."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.db.models import new_id

router = APIRouter(tags=["live"])


class LiveStart(BaseModel):
    children: list[str] = []


@router.post("/live/start")
def live_start(body: LiveStart):
    return {"session_id": new_id("s_live")}


@router.websocket("/live/{session_id}")
async def live_stream(ws: WebSocket, session_id: str):
    await ws.accept()
    try:
        while True:
            msg = await ws.receive_json()  # {"t": 12.33, "image": "<base64 JPEG>"}
            await ws.send_json({"frame": {"t": msg.get("t", 0), "people": [], "objects": []}, "alerts": []})
    except WebSocketDisconnect:
        pass


@router.post("/live/{session_id}/stop")
def live_stop(session_id: str):
    return {"session_id": session_id}
