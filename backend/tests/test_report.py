from app.pipeline.report import build_report


def test_basic_totals():
    segments = [
        {"child_id": "c1", "category": "screen", "state": "tv", "start_s": 0, "end_s": 210},
        {"child_id": "c1", "category": "screen", "state": "tablet", "start_s": 210, "end_s": 300},
        {"child_id": "c1", "category": "activity", "state": "still", "start_s": 0, "end_s": 340},
        {"child_id": "c1", "category": "presence", "state": "present", "start_s": 0, "end_s": 900},
    ]
    children = [{"id": "c1", "name": "Sara", "age_group": "5-12", "track_ids": [1]}]
    report = build_report({"id": "s1"}, children, segments, [])

    t = report["totals"]["c1"]
    assert t["tv_s"] == 210
    assert t["tablet_s"] == 90
    assert t["multi_screen_s"] == 0
    assert t["present_s"] == 900
    assert t["longest_still"] == {"duration_s": 340, "start_s": 0, "during": "tv"}