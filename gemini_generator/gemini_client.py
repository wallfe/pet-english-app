"""
Gemini API Client
"""
import json
import logging
import time
from typing import Dict, Any, Optional

import google.generativeai as genai

from gemini_generator.config import GEMINI_API_KEY, GEMINI_MODEL, TEMPERATURE, MAX_OUTPUT_TOKENS

logger = logging.getLogger(__name__)


class GeminiClient:
    """Wrapper for Gemini API"""

    def __init__(self, api_key: str = GEMINI_API_KEY):
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set. Please set it in environment variables.")

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(GEMINI_MODEL)

        logger.info(f"Initialized Gemini client with model: {GEMINI_MODEL}")

    def generate(self, prompt: str, max_retries: int = 3) -> Optional[str]:
        """
        Generate content using Gemini API
        Returns: Generated text or None on failure
        """
        for attempt in range(max_retries):
            try:
                response = self.model.generate_content(
                    prompt,
                    generation_config={
                        'temperature': TEMPERATURE,
                        'max_output_tokens': MAX_OUTPUT_TOKENS,
                    }
                )

                if response.text:
                    return response.text.strip()
                else:
                    logger.warning(f"Empty response from Gemini (attempt {attempt + 1})")

            except Exception as e:
                logger.error(f"Gemini API error (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.info(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)

        return None

    def generate_json(self, prompt: str, max_retries: int = 3) -> Optional[Dict[str, Any]]:
        """
        Generate content and parse as JSON
        Returns: Parsed JSON dict or None on failure
        """
        text = self.generate(prompt, max_retries)

        if not text:
            return None

        # Try to extract JSON from response
        try:
            # Remove markdown code blocks if present
            text = text.strip()
            if text.startswith('```json'):
                text = text[7:]
            if text.startswith('```'):
                text = text[3:]
            if text.endswith('```'):
                text = text[:-3]

            text = text.strip()

            return json.loads(text)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.debug(f"Response text: {text}")
            return None
