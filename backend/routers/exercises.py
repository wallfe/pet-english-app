"""
Exercises API Router
Handles PET-style exercise endpoints
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from backend.config import settings
from backend.services.db_service import DatabaseService

router = APIRouter()
db = DatabaseService(settings.db_path)


class AnswerRequest(BaseModel):
    """Request model for submitting an answer"""
    user_answer: str


@router.get("/", response_model=List[Dict[str, Any]])
async def get_exercises(
    session_id: Optional[int] = None,
    exercise_type: Optional[str] = None,
    limit: int = 10
):
    """Get exercises with optional filters"""
    return db.get_exercises(
        session_id=session_id,
        exercise_type=exercise_type,
        limit=limit
    )


@router.post("/{exercise_id}/submit", response_model=Dict[str, Any])
async def submit_answer(exercise_id: int, answer: AnswerRequest):
    """Submit an answer to an exercise"""
    result = db.submit_exercise_answer(exercise_id, answer.user_answer)

    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])

    return result
