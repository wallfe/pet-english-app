"""Vocabulary module — flashcards, SM-2 review, AI quiz."""
import json
import random
from pathlib import Path
from typing import Optional

import yaml
from fastapi import APIRouter, Query
from pydantic import BaseModel

from config import MOCK_MODE
from services.qwen import generate, generate_with_retry, MOCK_MCQ, MOCK_FILL_BLANK, MOCK_VOCAB_EXAMPLE
from services.quality import validate_mcq, validate_fill_blank, self_check

router = APIRouter()

# Load word lists
DATA_DIR = Path(__file__).parent.parent / "data"
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

_wordlists = {}


def _load_wordlists():
    global _wordlists
    if _wordlists:
        return _wordlists
    for level in ["b1", "b2"]:
        path = DATA_DIR / f"{level}_wordlist.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                _wordlists[level.upper()] = json.load(f)
    return _wordlists


def _load_prompts():
    path = PROMPTS_DIR / "vocab.yaml"
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _get_words(level: str = "all", topic: str = "all", count: int = 20):
    """Get random words from word lists."""
    wl = _load_wordlists()
    all_words = []

    levels = ["B1", "B2"] if level == "all" else [level.upper()]
    for lv in levels:
        data = wl.get(lv, {})
        topics = data.get("topics", {})
        if topic == "all":
            for t_words in topics.values():
                for w in t_words:
                    w["level"] = lv
                    all_words.append(w)
        elif topic in topics:
            for w in topics[topic]:
                w["level"] = lv
                all_words.append(w)

    random.shuffle(all_words)
    return all_words[:count]


# --- Endpoints ---


@router.get("/words")
async def get_words(
    level: str = Query("all", regex="^(B1|B2|all)$"),
    topic: str = Query("all"),
    count: int = Query(20, ge=1, le=50),
):
    """Get random words for flashcards."""
    words = _get_words(level, topic, count)
    return {"words": words, "total": len(words)}


@router.get("/topics")
async def get_topics():
    """Get available topics."""
    wl = _load_wordlists()
    topics = set()
    for data in wl.values():
        topics.update(data.get("topics", {}).keys())
    return {"topics": sorted(topics)}


class ExampleRequest(BaseModel):
    word: str
    pos: str = "n"
    level: str = "B1"


@router.post("/generate-example")
async def generate_example(req: ExampleRequest):
    """Generate an example sentence for a word."""
    if MOCK_MODE:
        return MOCK_VOCAB_EXAMPLE

    prompts = _load_prompts()
    cfg = prompts["example_sentence"]
    prompt = cfg["prompt"].format(word=req.word, pos=req.pos, level=req.level)
    result = await generate_with_retry(prompt, system=cfg["system"])
    return result


class QuizRequest(BaseModel):
    level: str = "B1"
    topic: str = "all"
    count: int = 5
    quiz_type: str = "mcq"  # mcq or fill_blank


@router.post("/quiz")
async def generate_quiz(req: QuizRequest):
    """Generate vocabulary quiz questions."""
    words = _get_words(req.level, req.topic, req.count * 2)
    prompts = _load_prompts()

    if MOCK_MODE:
        questions = []
        for i in range(min(req.count, len(words))):
            if req.quiz_type == "mcq":
                q = {**MOCK_MCQ, "word": words[i]["word"]}
            else:
                q = {**MOCK_FILL_BLANK, "answer": words[i]["word"], "hint": words[i].get("zh", "")}
            questions.append(q)
        return {"questions": questions, "mock": True}

    questions = []
    for i in range(0, len(words), 4):
        batch = words[i : i + 4]
        if len(batch) < 2:
            break

        if req.quiz_type == "mcq":
            cfg = prompts["mcq_quiz"]
            word_str = ", ".join(f"{w['word']}({w.get('zh', '')})" for w in batch)
            prompt = cfg["prompt"].format(words=word_str)
            result = await generate_with_retry(prompt, system=cfg["system"])
        else:
            w = batch[0]
            cfg = prompts["fill_blank"]
            prompt = cfg["prompt"].format(
                word=w["word"], pos=w.get("pos", ""), zh=w.get("zh", ""), level=req.level
            )
            result = await generate_with_retry(prompt, system=cfg["system"])

        # Validate
        if req.quiz_type == "mcq":
            error = validate_mcq(result)
        else:
            error = validate_fill_blank(result)

        if error:
            result["validation_warning"] = error
        questions.append(result)

        if len(questions) >= req.count:
            break

    return {"questions": questions[:req.count]}


class ConfusablesRequest(BaseModel):
    words: list[str]


@router.post("/confusables")
async def get_confusables(req: ConfusablesRequest):
    """Explain confusable words."""
    if MOCK_MODE:
        return {"words": req.words, "differences": "Mock mode — set API key for real explanations.", "examples": []}

    prompts = _load_prompts()
    cfg = prompts["confusables"]
    prompt = cfg["prompt"].format(words=", ".join(req.words))
    result = await generate_with_retry(prompt, system=cfg["system"])
    return result


class ReportRequest(BaseModel):
    question_id: Optional[str] = None
    question: dict
    reason: str = ""


@router.post("/report-error")
async def report_error(req: ReportRequest):
    """Report a problematic question."""
    # In production, save to DB. For now, log it.
    report_path = DATA_DIR / "error_reports.jsonl"
    with open(report_path, "a", encoding="utf-8") as f:
        f.write(json.dumps({"question": req.question, "reason": req.reason}, ensure_ascii=False) + "\n")
    return {"status": "reported"}
