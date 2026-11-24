# API contract

This file is the agreement between the backend and the frontend. Change it only after the team agrees, and update `frontend/src/mocks/` in the same pull request.

## Conventions

- All times inside a video are **seconds from the start of the video** (`start_s`, `end_s`), as numbers.
- All durations are **seconds** (`tv_s`, `active_s`). The frontend converts them to minutes for display.
- Dates are ISO strings: `"2026-11-25"`. Timestamps are ISO with timezone: `"2026-11-25T16:00:00+03:00"`.
- Box and keypoint coordinates are **normalized from 0 to 1** (fraction of video width and height), so they work at any display size.
- IDs are strings.

## Enums

| Name | Values |
|---|---|
| Screen state | `tv`, `tablet`, `phone`, `multi_screen`, `none` |
| Activity state | `active`, `light`, `still` |
| Presence state | `present`, `absent` |
| Event type | `fall`, `danger_zone`, `violent_contact` |
| Job status | `queued`, `processing`, `done`, `failed` |
| Age group | `3-4`, `5-12` |

## Endpoints

### Health
`GET /health` → `{"status": "ok"}`

### Children (setup screen)
`GET /children` → list of children

`POST /children`
```json
{ "name": "Sara", "age_group": "5-12", "color": "#7B5CC6" }
```
→ the created child:
```json
{ "id": "c1", "name": "Sara", "age_group": "5-12", "color": "#7B5CC6" }
```
`color` is optional. It's the child's identity color, picked in setup and used only for their avatar, page tint and video boxes.

`PATCH /children/{child_id}` with any of `name`, `color` → the updated child.

### Danger zones (setup screen)
Zones belong to the room, not to a child. `polygon` is a list of `[x, y]` points, normalized.

`GET /zones` → list of zones

`POST /zones`
```json
{ "name": "Kitchen", "polygon": [[0.62, 0.40], [0.95, 0.40], [0.95, 0.90], [0.62, 0.90]] }
```
→ the created zone with its `id`.

`DELETE /zones/{zone_id}` → `{"deleted": true}`

### Analyze a video (upload + processing screens)
`POST /analyze` (multipart form)
- `video`: the video file
- `session_date` (optional): `"2026-11-25"`, defaults to today

→ returns immediately:
```json
{ "job_id": "j_8f2a" }
```

`GET /jobs/{job_id}` (the frontend polls this every 2 seconds)
```json
{
  "job_id": "j_8f2a",
  "status": "processing",
  "progress": 42,
  "step": "Tracking people",
  "session_id": null,
  "error": null
}
```
When `status` is `done`, `session_id` is set and the frontend opens the session.

### Live mode (phase 2)
Live mode uses the same engine as upload. The browser sends webcam frames, the backend sends back overlays and states, and when live mode stops it becomes a normal session.

`POST /live/start`
```json
{ "children": ["c1"] }
```
→
```json
{ "session_id": "s_live_01" }
```

`WS /live/{session_id}`: a WebSocket. The browser sends about 2–3 messages per second:
```json
{ "t": 12.33, "image": "<base64 JPEG>" }
```
The backend answers each one with a frame in the **Frame overlays** format, plus any new alert:
```json
{
  "frame": { "t": 12.33, "people": [], "objects": [] },
  "alerts": []
}
```

`POST /live/{session_id}/stop` → `{ "session_id": "s_live_01" }`. The session then appears in `GET /sessions` like an uploaded video.

### Sessions (one analyzed video = one session)
`GET /sessions` → list, newest first:
```json
[{ "id": "s1", "date": "2026-11-25", "duration_s": 900, "children": ["c1", "c2"], "alerts": 3 }]
```

`GET /sessions/{session_id}` → the full report. See **Session report** below.

`GET /sessions/latest` → the newest saved session (the demo session `s1` while there is none). The dashboard opens this one.

Uploaded videos are served at `/media/uploads/...`; `video.url` in a saved report is that path.

`GET /sessions/{session_id}/frames` → overlays for the video review screen. See **Frame overlays** below.

### Summary (dashboard: day / week / month)
`GET /summary?child_id=c1&range=week&end_date=2026-11-25`
- `range`: `day`, `week` or `month`
- `child_id`: optional; without it, all children are combined

```json
{
  "child_id": "c1",
  "range": "week",
  "start_date": "2026-11-19",
  "end_date": "2026-11-25",
  "days": [
    {
      "date": "2026-11-25",
      "tv_s": 2700, "tablet_s": 1800, "phone_s": 300, "multi_screen_s": 900,
      "active_s": 1500, "light_s": 2100, "still_s": 6300,
      "longest_still_s": 4200,
      "alerts": 2,
      "is_demo_data": false
    }
  ],
  "totals": {
    "tv_s": 15400, "tablet_s": 11200, "phone_s": 2100, "multi_screen_s": 4800,
    "active_s": 9800, "light_s": 14200, "still_s": 40100,
    "alerts": 7
  },
  "guideline": { "age_group": "5-12", "active_target_s_per_day": 3600 }
}
```
`days` are ordered newest first. `is_demo_data: true` marks generated history, and the UI must label it as demo data.

### Alerts
`GET /alerts?range=week&end_date=2026-11-25&type=fall` → list of events (same shape as `events` in the session report, plus `session_id` and `date`).

`PATCH /alerts/{event_id}`
```json
{ "reviewed": true }
```

### Insights (stretch goal)
`POST /insights/ask`
```json
{ "question": "How was Sara's week compared to last week?", "child_id": "c1" }
```
→
```json
{ "answer": "Sara's screen time went up 18% ...", "sources": ["summary:week:2026-11-25"] }
```

## Session report

Returned by `GET /sessions/{session_id}`.

```json
{
  "id": "s1",
  "date": "2026-11-25",
  "started_at": "2026-11-25T16:00:00+03:00",
  "video": {
    "url": "https://.../s1.mp4",
    "duration_s": 900,
    "width": 1920,
    "height": 1080,
    "analyzed_fps": 3
  },
  "children": [
    { "id": "c1", "name": "Sara", "age_group": "5-12", "track_ids": [1] }
  ],
  "segments": [
    { "child_id": "c1", "category": "screen",   "state": "tv",     "start_s": 0,   "end_s": 210 },
    { "child_id": "c1", "category": "activity", "state": "still",  "start_s": 0,   "end_s": 340 },
    { "child_id": "c1", "category": "presence", "state": "present","start_s": 0,   "end_s": 900 }
  ],
  "totals": {
    "c1": {
      "tv_s": 300, "tablet_s": 180, "phone_s": 0, "multi_screen_s": 120, "none_s": 300,
      "active_s": 140, "light_s": 220, "still_s": 540,
      "present_s": 900,
      "longest_still": { "duration_s": 340, "start_s": 0, "during": "tv" }
    }
  },
  "events": [
    {
      "id": "e1",
      "child_id": "c1",
      "type": "danger_zone",
      "start_s": 512, "end_s": 530,
      "confidence": 0.91,
      "zone_id": "z1",
      "clip_url": "https://.../e1.mp4",
      "reviewed": false
    }
  ]
}
```

Rules:
- Within one child and one `category`, segments never overlap and cover the time the child is present.
- `multi_screen` time is **not** also counted in `tv_s` or `tablet_s`.
- `confidence` is between 0 and 1. `zone_id` is only set for `danger_zone` events.

## Frame overlays

Returned by `GET /sessions/{session_id}/frames`. One entry per analyzed frame. The frontend draws these on a canvas over the video.

```json
{
  "analyzed_fps": 3,
  "frames": [
    {
      "t": 12.33,
      "people": [
        {
          "track_id": 1,
          "child_id": "c1",
          "box": [0.31, 0.22, 0.52, 0.88],
          "keypoints": [[0.41, 0.27, 0.98], "... 17 points as [x, y, confidence]"],
          "screen": "tv",
          "activity": "still"
        }
      ],
      "objects": [
        { "label": "tv", "box": [0.02, 0.10, 0.28, 0.45], "on": true },
        { "label": "tablet", "box": [0.40, 0.55, 0.47, 0.63], "held_by": 1 }
      ]
    }
  ]
}
```
`box` is `[x1, y1, x2, y2]`. Keypoints follow the COCO order (nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles).
