"""
Gemini Generator Configuration
"""
import os
from pathlib import Path

# Gemini API settings
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = 'gemini-2.0-flash-exp'  # Gemini 2.0 Flash

# Generation parameters
TEMPERATURE = 0.7
MAX_OUTPUT_TOKENS = 2048

# Difficulty levels
DIFFICULTY_LEVELS = ['easy', 'medium', 'hard']

# Exercise types for PET exam
EXERCISE_TYPES = {
    'reading': [
        'reading_multiple_choice',
        'reading_gapped_text',
        'reading_matching'
    ],
    'listening': [
        'listening_multiple_choice',
        'listening_gap_fill'
    ],
    'vocabulary': [
        'vocab_definition_match',
        'vocab_fill_in_blank',
        'vocab_word_formation'
    ],
    'grammar': [
        'grammar_fill_in_blank',
        'grammar_error_correction',
        'grammar_sentence_transform'
    ]
}

# Prompt templates
FLASHCARD_PROMPT = """You are an expert English teacher creating flashcards for Chinese children (age 10-14) preparing for the Cambridge PET exam.

Given this vocabulary word and its English definition, create a child-friendly flashcard:

Word: {word}
English Definition: {definition}

Please provide:
1. A simple Chinese definition (suitable for 10-14 year olds)
2. An engaging English example sentence (B1/PET level)
3. Chinese translation of the example sentence
4. Difficulty level (easy/medium/hard for PET B1 level)

Respond in JSON format:
{{
  "definition_cn": "...",
  "example_en": "...",
  "example_cn": "...",
  "difficulty": "easy|medium|hard"
}}
"""

EXERCISE_PROMPT = """You are an expert Cambridge PET exam question writer.

Create a {exercise_type} exercise based on the following content:

Session Type: {session_type}
Content: {content}
Vocabulary: {vocabulary}

Requirements:
- Follow standard PET exam format
- Use B1 level English
- Include 4 options (A/B/C/D) for multiple choice
- Provide a clear explanation in Chinese (for 10-14 year olds)

Respond in JSON format:
{{
  "question": "...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correct_answer": "A|B|C|D",
  "explanation": "...",
  "difficulty": "easy|medium|hard"
}}
"""

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
DB_PATH = PROJECT_ROOT / "data" / "bbc_learning.db"
