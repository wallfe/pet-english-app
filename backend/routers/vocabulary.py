"""
Vocabulary API Router
Handles flashcard endpoints with SM-2 spaced repetition
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from backend.config import settings
from backend.services.db_service import DatabaseService

router = APIRouter()
db = DatabaseService(settings.db_path)


class ReviewRequest(BaseModel):
    """Request model for reviewing a flashcard"""
    quality: int  # 0-5


@router.get("/flashcards", response_model=List[Dict[str, Any]])
async def get_flashcards(limit: Optional[int] = 20, difficulty: Optional[str] = None):
    """Get flashcards with optional filters"""
    return db.get_flashcards(limit=limit, difficulty=difficulty)


@router.get("/flashcards/due", response_model=List[Dict[str, Any]])
async def get_due_flashcards(limit: int = 20):
    """Get flashcards due for review"""
    return db.get_due_flashcards(limit=limit)


@router.post("/flashcards/{card_id}/review", response_model=Dict[str, Any])
async def review_flashcard(card_id: int, review: ReviewRequest):
    """Record a flashcard review"""
    if review.quality < 0 or review.quality > 5:
        raise HTTPException(status_code=400, detail="Quality must be between 0 and 5")

    result = db.review_flashcard(card_id, review.quality)
    return result
