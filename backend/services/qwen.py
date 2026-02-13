"""Qwen API wrapper — DashScope OpenAI-compatible endpoint."""
import json
import logging
import random
from typing import Optional

import httpx
from config import QWEN_API_KEY, QWEN_BASE_URL, QWEN_MODEL, MOCK_MODE

logger = logging.getLogger(__name__)

MOCK_VOCAB_EXAMPLE = {
    "word": "example",
    "sentence": "This is an example sentence for testing.",
    "sentence_zh": "这是一个用于测试的例句。",
}

MOCK_MCQ = {
    "question": "What does 'abandon' mean?",
    "options": ["放弃", "收集", "创造", "保护"],
    "answer": "放弃",
    "explanation": "'Abandon' means to give up completely. 放弃意为完全停止做某事。",
}

MOCK_FILL_BLANK = {
    "sentence": "She decided to _____ her old habits and start fresh.",
    "hint": "放弃",
    "answer": "abandon",
    "explanation": "'Abandon' means to give up. The sentence means she decided to give up her old habits.",
}


async def generate(
    prompt: str,
    system: Optional[str] = None,
    json_mode: bool = True,
    temperature: float = 0.7,
) -> dict:
    """Call Qwen API. Returns parsed JSON or raw text in {'text': ...}."""
    if MOCK_MODE:
        logger.info("[MOCK] Qwen call skipped — returning placeholder")
        return {"mock": True, "text": "Mock response — set QWEN_API_KEY to enable real AI."}

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    body = {
        "model": QWEN_MODEL,
        "messages": messages,
        "temperature": temperature,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {QWEN_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{QWEN_BASE_URL}/chat/completions",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()

    data = resp.json()
    content = data["choices"][0]["message"]["content"]

    if json_mode:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse JSON from Qwen: {content[:200]}")
            return {"text": content}
    return {"text": content}


async def generate_with_retry(
    prompt: str,
    system: Optional[str] = None,
    json_mode: bool = True,
    retries: int = 2,
    temperature: float = 0.7,
) -> dict:
    """Generate with retry on failure."""
    for attempt in range(retries + 1):
        try:
            return await generate(prompt, system, json_mode, temperature)
        except Exception as e:
            logger.warning(f"Qwen attempt {attempt + 1} failed: {e}")
            if attempt == retries:
                raise
    return {}
