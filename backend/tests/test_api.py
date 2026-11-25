"""Basic checks that the API matches docs/api.md. Run with: pytest"""
import time

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_create_child_and_zone():
    child = client.post("/children", json={"name": "Sara", "age_group": "5-12", "color": "#7B5CC6"}).json()
    assert child["color"] == "#7B5CC6"
    updated = client.patch(f"/children/{child['id']}", json={"color": "#B5508C"}).json()
    assert updated["color"] == "#B5508C"
    renamed = client.patch(f"/children/{child['id']}", json={"name": "Sarah", "age_group": "3-4"}).json()
    assert (renamed["name"], renamed["age_group"]) == ("Sarah", "3-4")
    assert child["id"].startswith("c_")
    zone = client.post("/zones", json={"name": "Kitchen", "polygon": [[0, 0], [1, 0], [1, 1]]}).json()
    assert zone["id"].startswith("z_")
    assert client.delete(f"/zones/{zone['id']}").json() == {"deleted": True}
    assert client.delete(f"/children/{child['id']}").json() == {"deleted": True}
    assert all(c["id"] != child["id"] for c in client.get("/children").json())


def test_session_report_shape():
    r = client.get("/sessions/s1").json()
    for key in ("id", "date", "video", "children", "segments", "totals", "events"):
        assert key in r


def test_upload_job_finishes(monkeypatch):
    # Replaces the real pipeline with a fake one, so the test needs no real video or models
    import app.api.jobs as jobs_module

    def fake_run_video(video_path, children, zones, on_progress, frames_path=None):
        on_progress(50, "Following the children")
        return {
            "id": None, "date": None, "started_at": None,
            "video": {"url": None, "duration_s": 10, "width": 64, "height": 48, "analyzed_fps": 3},
            "children": [], "segments": [], "totals": {}, "events": [],
        }

    monkeypatch.setattr(jobs_module, "run_video", fake_run_video)

    files = {"video": ("clip.mp4", b"fake-bytes", "video/mp4")}
    job = client.post("/analyze", files=files).json()
    status = client.get(f"/jobs/{job['job_id']}").json()
    assert status["status"] in ("queued", "processing", "done")


def test_live_websocket():
    sid = client.post("/live/start", json={"children": []}).json()["session_id"]
    with client.websocket_connect(f"/live/{sid}") as ws:
        ws.send_json({"t": 1.0, "image": ""})
        assert ws.receive_json()["frame"]["t"] == 1.0
