"""
Courses API Router
Handles course structure endpoints (levels, units, sessions, activities)
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

from backend.config import settings
from backend.services.db_service import DatabaseService

router = APIRouter()
db = DatabaseService(settings.db_path)


@router.get("/levels", response_model=List[Dict[str, Any]])
async def get_levels():
    """Get all course levels"""
    return db.get_levels()


@router.get("/levels/{level_id}/units", response_model=List[Dict[str, Any]])
async def get_units(level_id: str):
    """Get all units for a level"""
    return db.get_units(level_id)


@router.get("/units/{unit_id}", response_model=Dict[str, Any])
async def get_unit(unit_id: int):
    """Get a single unit"""
    unit = db.get_unit(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit


@router.get("/units/{unit_id}/sessions", response_model=List[Dict[str, Any]])
async def get_sessions(unit_id: int):
    """Get all sessions for a unit"""
    return db.get_sessions(unit_id)


@router.get("/sessions/{session_id}", response_model=Dict[str, Any]])
async def get_session(session_id: int):
    """Get a single session"""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/{session_id}/activities", response_model=List[Dict[str, Any]])
async def get_activities(session_id: int):
    """Get all activities for a session"""
    return db.get_activities(session_id)


@router.get("/activities/{activity_id}", response_model=Dict[str, Any])
async def get_activity(activity_id: int):
    """Get a single activity with full content"""
    activity = db.get_activity(activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity


@router.get("/sessions/{session_id}/vocabulary", response_model=List[Dict[str, Any]])
async def get_session_vocabulary(session_id: int):
    """Get vocabulary items for a session"""
    return db.get_session_vocabulary(session_id)
