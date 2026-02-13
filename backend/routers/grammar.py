"""Grammar module — exercises, diagnostics, explanations."""
import yaml
from pathlib import Path
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from config import MOCK_MODE
from services.qwen import generate_with_retry

router = APIRouter()

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

GRAMMAR_TOPICS = [
    "present simple", "present continuous", "past simple", "past continuous",
    "present perfect", "future (will/going to)", "passive voice",
    "first conditional", "second conditional", "comparatives and superlatives",
    "relative clauses", "modal verbs", "articles", "prepositions",
    "reported speech", "gerunds and infinitives",
]

MOCK_GRAMMAR_MCQ = {
    "sentence": "If I _____ more time, I would travel the world.",
    "options": ["had", "have", "will have", "having"],
    "answer": "had",
    "grammar_point": "second conditional",
    "explanation": "Second conditional uses 'if + past simple'. 第二条件句用 if + 过去时。",
}

MOCK_ERROR_CORRECTION = {
    "sentence": "She don't like swimming.",
    "has_error": True,
    "corrected": "She doesn't like swimming.",
    "grammar_point": "subject-verb agreement",
    "explanation": "Third person singular requires 'doesn't'. 第三人称单数用 doesn't。",
}


def _load_prompts():
    with open(PROMPTS_DIR / "grammar.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


class ExerciseRequest(BaseModel):
    exercise_type: str = "mcq"  # mcq or error_correction
    topic: Optional[str] = None
    count: int = 5


@router.post("/exercise")
async def generate_exercise(req: ExerciseRequest):
    """Generate grammar exercises."""
    import random
    topic = req.topic or random.choice(GRAMMAR_TOPICS)

    if MOCK_MODE:
        if req.exercise_type == "mcq":
            return {"questions": [MOCK_GRAMMAR_MCQ] * req.count, "topic": topic, "mock": True}
        return {"questions": [MOCK_ERROR_CORRECTION] * req.count, "topic": topic, "mock": True}

    prompts = _load_prompts()
    cfg = prompts["exercise"]
    questions = []

    for _ in range(req.count):
        if req.exercise_type == "mcq":
            prompt = cfg["mcq_prompt"].format(topic=topic)
        else:
            prompt = cfg["error_correction_prompt"].format(topic=topic)

        result = await generate_with_retry(prompt, system=cfg["system"])
        questions.append(result)

    return {"questions": questions, "topic": topic}


@router.get("/topics")
async def get_topics():
    """Get available grammar topics."""
    return {"topics": GRAMMAR_TOPICS}


class DiagnoseRequest(BaseModel):
    errors: list[dict]


@router.post("/diagnose")
async def diagnose(req: DiagnoseRequest):
    """Analyze grammar errors and identify weak points."""
    if MOCK_MODE:
        return {
            "weak_points": [{"area": "conditionals", "severity": "high", "tip": "Practice if-clauses"}],
            "recommendation": "Focus on conditional sentences.",
            "mock": True,
        }

    prompts = _load_prompts()
    cfg = prompts["diagnose"]
    errors_str = "\n".join(
        f"- Q: {e.get('question', '')}, Wrong: {e.get('student_answer', '')}, Correct: {e.get('correct_answer', '')}"
        for e in req.errors
    )
    prompt = cfg["prompt"].format(errors=errors_str)
    return await generate_with_retry(prompt, system=cfg["system"])


class ExplainRequest(BaseModel):
    question: str
    student_answer: str
    correct_answer: str


@router.post("/explain")
async def explain(req: ExplainRequest):
    """Explain a grammar rule for a wrong answer."""
    if MOCK_MODE:
        return {
            "rule": "Mock grammar rule",
            "explanation": "Set QWEN_API_KEY for real explanations.",
            "explanation_zh": "设置 API 密钥以获取真实解释。",
            "more_examples": [],
            "mock": True,
        }

    prompts = _load_prompts()
    cfg = prompts["explain"]
    prompt = cfg["prompt"].format(
        question=req.question,
        student_answer=req.student_answer,
        correct_answer=req.correct_answer,
    )
    return await generate_with_retry(prompt, system=cfg["system"])
