#!/usr/bin/env python3
"""
Exercise Generator using Gemini
Generates PET-style exercises from session content
"""
import argparse
import json
import logging
import sqlite3
import sys
from typing import Optional, List

from gemini_generator.config import EXERCISE_PROMPT, EXERCISE_TYPES, DB_PATH
from gemini_generator.gemini_client import GeminiClient

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ExerciseGenerator:
    """Generate PET-style exercises using Gemini"""

    def __init__(self, db_path: str = str(DB_PATH)):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.gemini = GeminiClient()

    def close(self):
        """Close database connection"""
        self.conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def get_sessions_without_exercises(self, limit: Optional[int] = None) -> List[dict]:
        """Get sessions that don't have exercises yet"""
        cursor = self.conn.cursor()

        query = """
            SELECT
                s.session_id,
                s.type,
                s.title,
                s.transcript_text,
                u.level_id,
                u.unit_number
            FROM sessions s
            JOIN units u ON s.unit_id = u.unit_id
            LEFT JOIN exercises e ON e.session_id = s.session_id
            WHERE e.exercise_id IS NULL
            AND s.transcript_text IS NOT NULL
            AND s.transcript_text != ''
        """

        if limit:
            query += f" LIMIT {limit}"

        return [dict(row) for row in cursor.execute(query).fetchall()]

    def get_session_vocabulary(self, session_id: int) -> List[dict]:
        """Get vocabulary items for a session"""
        cursor = self.conn.cursor()

        query = """
            SELECT word, definition
            FROM session_vocabulary
            WHERE session_id = ?
            AND word IS NOT NULL
            AND word != ''
        """

        return [dict(row) for row in cursor.execute(query, (session_id,)).fetchall()]

    def determine_exercise_types(self, session_type: str) -> List[str]:
        """Determine appropriate exercise types for a session"""
        if session_type in EXERCISE_TYPES:
            return EXERCISE_TYPES[session_type]
        elif session_type in ['vocabulary', 'grammar']:
            return EXERCISE_TYPES['vocabulary'] + EXERCISE_TYPES['grammar']
        elif session_type in ['reading', 'listening']:
            return EXERCISE_TYPES[session_type]
        else:
            # Default to vocabulary exercises
            return EXERCISE_TYPES['vocabulary']

    def generate_exercise(self, session_id: int, session_type: str,
                         exercise_type: str, content: str, vocabulary: List[dict]) -> bool:
        """
        Generate an exercise for a session
        Returns: True if successful
        """
        logger.info(f"Generating {exercise_type} exercise for session {session_id}")

        # Format vocabulary for prompt
        vocab_text = "\n".join([
            f"- {v['word']}: {v.get('definition', '')}"
            for v in vocabulary
        ])

        # Build prompt
        prompt = EXERCISE_PROMPT.format(
            exercise_type=exercise_type.replace('_', ' '),
            session_type=session_type,
            content=content[:2000],  # Limit content length
            vocabulary=vocab_text or "No specific vocabulary"
        )

        # Generate exercise
        result = self.gemini.generate_json(prompt)

        if not result:
            logger.error(f"Failed to generate exercise")
            return False

        # Insert exercise
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO exercises
            (session_id, exercise_type, question, options, correct_answer,
             explanation, difficulty)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            session_id,
            exercise_type,
            result.get('question'),
            json.dumps(result.get('options', [])),
            result.get('correct_answer'),
            result.get('explanation'),
            result.get('difficulty', 'medium')
        ))

        self.conn.commit()

        logger.info(f"✓ Created {exercise_type} exercise")
        return True

    def generate_for_session(self, session_id: int, exercises_per_type: int = 2) -> int:
        """
        Generate exercises for a single session
        Returns: Number of exercises created
        """
        cursor = self.conn.cursor()

        # Get session info
        row = cursor.execute("""
            SELECT session_id, type, title, transcript_text
            FROM sessions
            WHERE session_id = ?
        """, (session_id,)).fetchone()

        if not row:
            logger.error(f"Session {session_id} not found")
            return 0

        session = dict(row)
        session_type = session['type']
        content = session['transcript_text'] or ""

        # Get vocabulary
        vocabulary = self.get_session_vocabulary(session_id)

        # Determine exercise types
        exercise_types = self.determine_exercise_types(session_type)

        logger.info(f"\nGenerating exercises for session {session_id} ({session_type})")
        logger.info(f"Exercise types: {', '.join(exercise_types)}")

        success_count = 0

        # Generate exercises for each type
        for ex_type in exercise_types[:2]:  # Limit to 2 types per session
            for i in range(exercises_per_type):
                success = self.generate_exercise(
                    session_id=session_id,
                    session_type=session_type,
                    exercise_type=ex_type,
                    content=content,
                    vocabulary=vocabulary
                )

                if success:
                    success_count += 1

        logger.info(f"✓ Created {success_count} exercises for session {session_id}")
        return success_count

    def generate_batch(self, batch_size: int = 5, exercises_per_session: int = 4) -> int:
        """
        Generate exercises in batch
        Returns: Total number of exercises created
        """
        sessions = self.get_sessions_without_exercises(limit=batch_size)

        if not sessions:
            logger.info("No sessions to process")
            return 0

        total = 0

        for session in sessions:
            count = self.generate_for_session(
                session_id=session['session_id'],
                exercises_per_type=exercises_per_session // 2
            )
            total += count

        logger.info(f"\n{'='*60}")
        logger.info(f"Batch complete: {total} exercises created for {len(sessions)} sessions")
        logger.info(f"{'='*60}\n")

        return total

    def generate_all(self) -> int:
        """
        Generate exercises for all sessions
        Returns: Total number of exercises created
        """
        total = 0
        batch_size = 5

        while True:
            count = self.generate_batch(batch_size)
            total += count

            if count == 0:
                break

        logger.info(f"\nAll done! Generated {total} exercises total")
        return total


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(description='Generate exercises using Gemini')
    parser.add_argument('--db', default=str(DB_PATH), help='Database path')
    parser.add_argument('--session', type=int, help='Generate for specific session ID')
    parser.add_argument('--batch', type=int, default=5,
                       help='Batch size (default: 5 sessions)')
    parser.add_argument('--all', action='store_true',
                       help='Generate exercises for all sessions')

    args = parser.parse_args()

    # Check if GEMINI_API_KEY is set
    import os
    if not os.getenv('GEMINI_API_KEY'):
        logger.error("GEMINI_API_KEY environment variable not set!")
        logger.error("Please set it with: export GEMINI_API_KEY='your-key-here'")
        sys.exit(1)

    with ExerciseGenerator(db_path=args.db) as generator:
        if args.session:
            generator.generate_for_session(args.session)
        elif args.all:
            generator.generate_all()
        else:
            generator.generate_batch(batch_size=args.batch)


if __name__ == '__main__':
    main()
