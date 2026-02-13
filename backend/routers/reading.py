"""Reading module — PET Reading Parts 1-6 with AI-generated questions."""
import json
import random
import yaml
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from config import MOCK_MODE
from services.qwen import generate_with_retry

router = APIRouter()

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
DATA_DIR = Path(__file__).parent.parent / "data"
ARTICLES_DIR = DATA_DIR / "articles"

MOCK_READING = {
    "passage": "The school library will be closed next Monday for cleaning. Students can use the computer room instead. Please return all books before Friday.",
    "questions": [
        {
            "question": "What does this notice say?",
            "options": ["A) The library is open on Monday", "B) Students should return books by Friday", "C) The computer room is closed"],
            "answer": "B",
            "explanation": "The notice says 'return all books before Friday'.",
        }
    ],
    "part": 1,
}


def _load_prompts():
    with open(PROMPTS_DIR / "reading.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _get_source_text():
    """Get a random cached article, or fallback to a simple text."""
    ARTICLES_DIR.mkdir(parents=True, exist_ok=True)
    articles = list(ARTICLES_DIR.glob("*.json"))
    if articles:
        with open(random.choice(articles), "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("text", data.get("content", ""))

    # Fallback sample texts for development
    samples = [
        "A new study shows that teenagers who read for pleasure perform better in school. Researchers found that students who read at least 30 minutes a day scored higher on reading and writing tests. The study also found that reading fiction helped develop empathy and social skills.",
        "The city council has announced plans to build a new sports centre near the park. The centre will include a swimming pool, gym, and indoor courts. Construction is expected to start in March and finish by December. Local residents are excited about the new facilities.",
        "More young people are choosing to learn cooking skills online. Popular video platforms now offer thousands of free cooking tutorials. Experts say that cooking at home is healthier and cheaper than eating out. Many teenagers are discovering that cooking can be a fun and creative hobby.",
    ]
    return random.choice(samples)


@router.get("/exercise")
async def get_exercise(part: int = Query(1, ge=1, le=6)):
    """Generate a reading exercise for the specified PET part."""
    if MOCK_MODE:
        return {**MOCK_READING, "part": part, "mock": True}

    prompts = _load_prompts()
    part_key = f"part{part}"
    cfg = prompts.get(part_key)
    if not cfg:
        return {"error": f"Part {part} not configured"}

    source = _get_source_text()
    prompt = cfg["prompt"].format(source_text=source)
    system = f"You are creating PET Reading Part {part} exercises. Always respond in JSON."

    result = await generate_with_retry(prompt, system=system)
    result["part"] = part
    result["part_name"] = cfg.get("name", "")
    return result


class CheckRequest(BaseModel):
    part: int
    answers: dict  # {question_index: user_answer}
    correct_answers: dict  # {question_index: correct_answer}
    questions: list[dict]


@router.post("/check")
async def check_answers(req: CheckRequest):
    """Check answers and provide AI explanations."""
    results = []
    for idx, q in enumerate(req.questions):
        user_ans = req.answers.get(str(idx), "")
        correct = req.correct_answers.get(str(idx), q.get("answer", ""))
        is_correct = user_ans == correct
        results.append({
            "question_index": idx,
            "correct": is_correct,
            "user_answer": user_ans,
            "correct_answer": correct,
            "explanation": q.get("explanation", ""),
        })
    score = sum(1 for r in results if r["correct"])
    return {"results": results, "score": score, "total": len(results)}


class AddWordRequest(BaseModel):
    word: str
    context: str = ""


@router.post("/add-word")
async def add_word(req: AddWordRequest):
    """Add a word from reading to word bank (logged for cross-module use)."""
    # In a real app, this would go to a shared store
    return {"status": "added", "word": req.word}
