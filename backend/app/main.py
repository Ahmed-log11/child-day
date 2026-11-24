"""FastAPI entry point. Run locally with: uvicorn app.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import children, insights, jobs, live, sessions
from app.config import settings
from app.db.session import Base, engine
from app.db import models  # noqa: F401  (registers the tables)
from app.weights import start_warm_up

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.use_mock_pipeline:
        start_warm_up()  # download missing weights and load the models in the background
    yield


app = FastAPI(title="Kanaf API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (children, jobs, sessions, live, insights):
    app.include_router(module.router)

# Uploaded videos (and later alert clips), so the review screen can play them
settings.storage_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.storage_dir), name="media")
# Short clips around alerts (storage.save_clip returns /clips/<name>)
(settings.storage_dir / "clips").mkdir(parents=True, exist_ok=True)
app.mount("/clips", StaticFiles(directory=settings.storage_dir / "clips"), name="clips")


@app.get("/")
def root():
    return {"name": "Kanaf API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
