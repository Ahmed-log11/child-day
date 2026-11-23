"""Setup screen: children and danger zones. These are real (stored in the database)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DbSession

from app.db.models import Child, Zone
from app.db.session import get_db

router = APIRouter(tags=["setup"])


class ChildIn(BaseModel):
    name: str
    age_group: str  # "3-4" or "5-12"
    color: str | None = None  # "#7B5CC6"


class ChildUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


def _child(c: Child) -> dict:
    return {"id": c.id, "name": c.name, "age_group": c.age_group, "color": c.color}


class ZoneIn(BaseModel):
    name: str
    polygon: list[list[float]]


@router.get("/children")
def list_children(db: DbSession = Depends(get_db)):
    return [_child(c) for c in db.query(Child).all()]


@router.post("/children")
def create_child(body: ChildIn, db: DbSession = Depends(get_db)):
    if body.age_group not in ("3-4", "5-12"):
        raise HTTPException(422, "age_group must be '3-4' or '5-12'")
    child = Child(name=body.name, age_group=body.age_group, color=body.color)
    db.add(child)
    db.commit()
    return _child(child)


@router.patch("/children/{child_id}")
def update_child(child_id: str, body: ChildUpdate, db: DbSession = Depends(get_db)):
    child = db.get(Child, child_id)
    if not child:
        raise HTTPException(404, "Child not found")
    if body.name is not None:
        child.name = body.name
    if body.color is not None:
        child.color = body.color
    db.commit()
    return _child(child)


@router.get("/zones")
def list_zones(db: DbSession = Depends(get_db)):
    return [{"id": z.id, "name": z.name, "polygon": z.polygon} for z in db.query(Zone).all()]


@router.post("/zones")
def create_zone(body: ZoneIn, db: DbSession = Depends(get_db)):
    if len(body.polygon) < 3:
        raise HTTPException(422, "A zone needs at least 3 points")
    zone = Zone(name=body.name, polygon=body.polygon)
    db.add(zone)
    db.commit()
    return {"id": zone.id, "name": zone.name, "polygon": zone.polygon}


@router.delete("/zones/{zone_id}")
def delete_zone(zone_id: str, db: DbSession = Depends(get_db)):
    zone = db.get(Zone, zone_id)
    if not zone:
        raise HTTPException(404, "Zone not found")
    db.delete(zone)
    db.commit()
    return {"deleted": True}
