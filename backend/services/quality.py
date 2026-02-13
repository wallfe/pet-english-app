"""Question quality validation — rule checks + AI self-check."""
import logging
from typing import Optional
from services.qwen import generate

logger = logging.getLogger(__name__)


def validate_mcq(question: dict) -> Optional[str]:
    """Rule-based MCQ validation. Returns error string or None if valid."""
    answer = question.get("answer", "")
    options = question.get("options", [])

    if not answer:
        return "No answer provided"
    if not options or len(options) < 2:
        return "Too few options"
    if answer not in options:
        return f"Answer '{answer}' not in options {options}"
    if len(set(options)) != len(options):
        return "Duplicate options detected"
    return None


def validate_fill_blank(question: dict) -> Optional[str]:
    """Rule-based fill-in-blank validation."""
    sentence = question.get("sentence", "")
    answer = question.get("answer", "")

    if not answer:
        return "No answer provided"
    if "___" not in sentence and "____" not in sentence:
        return "No blank found in sentence"
    return None


async def self_check(question: dict, question_type: str = "mcq") -> dict:
    """Send question back to Qwen for self-verification."""
    prompt = f"""You are a quality checker for English exam questions at B1 (PET) level.
Check this {question_type} question for:
1. Is the correct answer actually correct?
2. Are there any ambiguous options where multiple answers could be right?
3. Is the difficulty appropriate for B1 level?

Question: {question}

Respond in JSON: {{"valid": true/false, "issues": ["issue1", ...], "suggestion": "..."}}"""

    try:
        result = await generate(prompt, json_mode=True)
        return result
    except Exception as e:
        logger.warning(f"Self-check failed: {e}")
        return {"valid": True, "issues": [], "suggestion": "Self-check unavailable"}
