# Architecture

```
React (Vercel) ──HTTP / WebSocket──► FastAPI (Hugging Face Space, Docker)
                                         │
                       upload: file ─────┤
                       live: webcam ─────┤
                                         ▼
                                     Engine (frame by frame)
                                     ├─ perception: YOLO11 detect + pose + ByteTrack
                                     ├─ screens: devices, head direction, TV on/off
                                     ├─ activity: movement score
                                     ├─ zones / fall / violence
                                     └─ smoothing → report
                                         ▼
                                     Supabase (Postgres + clip storage)
```

## Decisions

- **One engine for upload and live.** Only the source of the frames differs.
- **Models look, rules decide.** Most features are rules on detections and keypoints, so they can be tuned fast. Training goes where it matters: the tablet detector and the violence classifier.
- **2–3 frames per second, OpenVINO export, small models.** Fast enough on a free CPU.
- **Overlays are drawn in the browser**, not burned into a new video on the server.
- **No full video is stored.** Only timelines and short alert clips.
- **Contract first.** `docs/api.md` is agreed before code; the frontend builds on mocks from day 1.
