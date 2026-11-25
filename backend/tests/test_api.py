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


def test_insights_without_claude_fall_back():
    # No ANTHROPIC_API_KEY in tests: the frontend shows its own advice
    r = client.post("/insights/day", json={"session_id": "s1", "child_id": "c1", "lang": "en"})
    assert r.status_code == 200
    assert r.json() == {"advice": None, "source": "none"}
    assert client.post("/insights/day", json={"session_id": "s1", "child_id": "nobody"}).status_code == 404
    r = client.post("/insights/ask", json={"session_id": "s1", "question": "How much did Sara move?"})
    assert r.status_code == 200 and r.json()["answer"] is None


def test_insights_with_claude(monkeypatch):
    from app import advice

    calls = []

    def fake(system, prompt, max_tokens):
        calls.append(prompt)
        if "advice items" in prompt:
            return 'Sure: [{"title": "Move more", "text": "Sara was active 2.3 min.", "action": "export"},' \
                   ' {"title": "Bad", "text": "x", "action": "launch"}]'
        return "Sara moved a lot."

    monkeypatch.setattr(advice, "_ask_claude", fake)
    r = client.post("/insights/day", json={"session_id": "s1", "child_id": "c2", "lang": "ar"}).json()
    assert r["source"] == "ai" and r["advice"][0]["action"] == "export" and r["advice"][1]["action"] == "none"
    # only numbers are sent, and the answer is cached
    assert '"screens_minutes"' in calls[0] and "Omar" in calls[0]
    client.post("/insights/day", json={"session_id": "s1", "child_id": "c2", "lang": "ar"})
    assert len(calls) == 1
    assert client.post("/insights/ask", json={"session_id": "s1", "question": "Did Sara move?"}).json()["answer"] == "Sara moved a lot."
