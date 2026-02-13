"""Listening module — BBC 6 Minute English (精听) + Kid Nuz (泛听)."""
import logging
from typing import Optional

import feedparser
from fastapi import APIRouter, Query
from pydantic import BaseModel

from config import MOCK_MODE
from services.qwen import generate_with_retry

router = APIRouter()
logger = logging.getLogger(__name__)

BBC_RSS = "https://podcasts.files.bbci.co.uk/p02pc9tn.rss"
KIDNUZ_RSS = "https://feeds.megaphone.fm/STM6212107967"

MOCK_EPISODE = {
    "title": "Mock Episode: Learning English",
    "audio_url": "",
    "transcript": "This is a mock transcript for testing. Set QWEN_API_KEY for real AI features.",
    "vocabulary": ["example", "learning", "practice"],
    "date": "2026-01-01",
}


def _parse_rss(url: str, max_episodes: int = 10) -> list:
    """Parse RSS feed and return episode list."""
    try:
        feed = feedparser.parse(url)
        episodes = []
        for i, entry in enumerate(feed.entries[:max_episodes]):
            audio_url = ""
            enclosures = entry.get("enclosures", [])
            if not enclosures:
                links = entry.get("links", [])
                enclosures = [l for l in links if l.get("type", "").startswith("audio/")]
            if enclosures:
                audio_url = enclosures[0].get("href", "") or enclosures[0].get("url", "")

            # Extract transcript from description/summary
            desc = entry.get("summary", "") or entry.get("description", "")
            content = entry.get("content", [])
            if content:
                desc = content[0].get("value", desc)

            episodes.append({
                "id": i,
                "title": entry.get("title", ""),
                "audio_url": audio_url,
                "description": desc[:500],
                "date": entry.get("published", ""),
            })
        return episodes
    except Exception as e:
        logger.error(f"RSS parse failed for {url}: {e}")
        return []


# --- BBC 6 Minute English ---

@router.get("/bbc/episodes")
async def bbc_episodes(count: int = Query(10, ge=1, le=20)):
    """List recent BBC 6 Minute English episodes."""
    if MOCK_MODE:
        return {"episodes": [MOCK_EPISODE], "mock": True}
    episodes = _parse_rss(BBC_RSS, count)
    return {"episodes": episodes}


@router.get("/bbc/episode/{episode_id}")
async def bbc_episode(episode_id: int):
    """Get a specific BBC episode with audio URL and description."""
    episodes = _parse_rss(BBC_RSS, 20)
    if episode_id < len(episodes):
        return episodes[episode_id]
    return {"error": "Episode not found"}


# --- Kid Nuz ---

@router.get("/kidnuz/episodes")
async def kidnuz_episodes(count: int = Query(10, ge=1, le=20)):
    """List recent Kid Nuz episodes."""
    if MOCK_MODE:
        return {"episodes": [MOCK_EPISODE], "mock": True}
    episodes = _parse_rss(KIDNUZ_RSS, count)
    return {"episodes": episodes}


# --- AI Question Generation ---

class GenerateQuestionsRequest(BaseModel):
    transcript: str
    count: int = 5


@router.post("/generate-questions")
async def generate_questions(req: GenerateQuestionsRequest):
    """Generate PET-format comprehension questions from a transcript."""
    if MOCK_MODE:
        return {
            "questions": [{
                "question": "What is the main topic?",
                "options": ["A) Sports", "B) Education", "C) Travel", "D) Food"],
                "answer": "B",
                "explanation": "Mock explanation.",
            }],
            "mock": True,
        }

    prompt = f"""Based on this audio transcript, create {req.count} PET-level listening comprehension questions.
Each question should have 4 options (A-D) with one correct answer.

Transcript:
{req.transcript[:3000]}

Respond in JSON:
{{"questions": [{{"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A", "explanation": "..."}}]}}"""

    system = "You are creating PET listening comprehension questions. Always respond in JSON."
    return await generate_with_retry(prompt, system=system)


class AddWordRequest(BaseModel):
    word: str
    source: str = "listening"


@router.post("/add-word")
async def add_word(req: AddWordRequest):
    """Add word to word bank from listening module."""
    return {"status": "added", "word": req.word, "source": req.source}
