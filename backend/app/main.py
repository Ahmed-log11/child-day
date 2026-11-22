"""FastAPI entry point. Run locally with: uvicorn app.main:app --reload"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import children, insights, jobs, live, sessions
from app.config import settings
from app.db.session import Base, engine
from app.db import models  # noqa: F401  (registers the tables)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Child Day API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (children, jobs, sessions, live, insights):
    app.include_router(module.router)


@app.get("/health")
def health():
    return {"status": "ok"}
