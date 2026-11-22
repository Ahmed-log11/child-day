# Backend

FastAPI app + the computer vision pipeline. Endpoints follow `docs/api.md`.

## Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://localhost:8000/docs to try every endpoint in the browser.

## Run the tests

```bash
pytest
```

## Current state

- **Real:** children, danger zones, upload + job progress, the database.
- **Mock:** session reports, summary, alerts, live mode and insights return the data in `app/mocks/`.
  When the pipeline is ready, set `USE_MOCK_PIPELINE=false` and connect `jobs.process_video` to `app/pipeline/run.py`.

## Folders

| Path | What it does |
|---|---|
| `app/main.py` | Starts the app, adds CORS, registers the endpoints |
| `app/config.py` | Settings from environment variables |
| `app/api/` | One file per group of endpoints |
| `app/db/` | Database connection and tables |
| `app/pipeline/` | The CV engine (next step) |
| `app/mocks/` | Mock responses, identical to `frontend/src/mocks/` |
