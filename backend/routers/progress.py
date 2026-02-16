"""
Progress API Router
Handles user progress tracking
"""
from fastapi import APIRouter
from typing import Dict, Any

from backend.config import settings
from backend.services.db_service import DatabaseService

router = APIRouter()
db = DatabaseService(settings.db_path)


@router.get("/", response_model=Dict[str, Any])
async def get_progress():
    """Get overall user progress statistics"""
    return db.get_user_progress()


@router.post("/activities/{activity_id}/complete")
async def mark_activity_complete(activity_id: int):
    """Mark an activity as completed"""
    success = db.mark_activity_complete(activity_id)
    return {"success": success}
