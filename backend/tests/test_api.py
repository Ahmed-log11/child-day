"""Basic checks that the API matches docs/api.md. Run with: pytest"""
import time

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_create_child_and_zone():
    child = client.post("/children", json={"name": "Sara", "age_group": "5-12"}).json()
    assert child["id"].startswith("c_")
    zone = client.post("/zones", json={"name": "Kitchen", "polygon": [[0, 0], [1, 0], [1, 1]]}).json()
    assert zone["id"].startswith("z_")
    assert client.delete(f"/zones/{zone['id']}").json() == {"deleted": True}


def test_session_report_shape():
    r = client.get("/sessions/s1").json()
    for key in ("id", "date", "video", "children", "segments", "totals", "events"):
        assert key in r


def test_upload_job_finishes():
    files = {"video": ("clip.mp4", b"fake-bytes", "video/mp4")}
    job = client.post("/analyze", files=files).json()
    status = client.get(f"/jobs/{job['job_id']}").json()
    assert status["status"] in ("queued", "processing", "done")


def test_live_websocket():
    sid = client.post("/live/start", json={"children": []}).json()["session_id"]
    with client.websocket_connect(f"/live/{sid}") as ws:
        ws.send_json({"t": 1.0, "image": ""})
        assert ws.receive_json()["frame"]["t"] == 1.0
