#!/usr/bin/env python3
"""
Flashcard Generator using Gemini
Generates child-friendly flashcards from vocabulary
"""
import argparse
import logging
import sqlite3
import sys
from pathlib import Path

from gemini_generator.config import FLASHCARD_PROMPT, DB_PATH
from gemini_generator.gemini_client import GeminiClient

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FlashcardGenerator:
    """Generate flashcards from vocabulary using Gemini"""

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

    def get_vocabulary_items(self, limit: Optional[int] = None) -> list:
        """
        Get vocabulary items that don't have flashcards yet
        Returns: List of (vocab_id, word, definition, source_table)
        """
        cursor = self.conn.cursor()

        # Get from session_vocabulary
        query = """
            SELECT sv.vocab_id, sv.word, sv.definition, 'session_vocabulary' as source_table
            FROM session_vocabulary sv
            LEFT JOIN flashcards f ON f.vocab_id = sv.vocab_id AND f.source_table = 'session_vocabulary'
            WHERE f.card_id IS NULL
            AND sv.word IS NOT NULL
            AND sv.word != ''
        """

        if limit:
            query += f" LIMIT {limit}"

        items = cursor.execute(query).fetchall()

        logger.info(f"Found {len(items)} vocabulary items without flashcards")
        return items

    def generate_flashcard(self, vocab_id: int, word: str, definition: str,
                          source_table: str) -> bool:
        """
        Generate a flashcard for a vocabulary item
        Returns: True if successful
        """
        logger.info(f"Generating flashcard for: {word}")

        # Build prompt
        prompt = FLASHCARD_PROMPT.format(
            word=word,
            definition=definition or "No definition provided"
        )

        # Generate content
        result = self.gemini.generate_json(prompt)

        if not result:
            logger.error(f"Failed to generate flashcard for: {word}")
            return False

        # Insert flashcard
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO flashcards
            (vocab_id, source_table, word, definition_en, definition_cn,
             example_en, example_cn, difficulty)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            vocab_id,
            source_table,
            word,
            definition,
            result.get('definition_cn'),
            result.get('example_en'),
            result.get('example_cn'),
            result.get('difficulty', 'medium')
        ))

        self.conn.commit()

        logger.info(f"✓ Created flashcard for: {word}")
        return True

    def generate_batch(self, batch_size: int = 10) -> int:
        """
        Generate flashcards in batch
        Returns: Number of flashcards created
        """
        items = self.get_vocabulary_items(limit=batch_size)

        if not items:
            logger.info("No vocabulary items to process")
            return 0

        success_count = 0

        for item in items:
            success = self.generate_flashcard(
                vocab_id=item['vocab_id'],
                word=item['word'],
                definition=item['definition'],
                source_table=item['source_table']
            )

            if success:
                success_count += 1

        logger.info(f"\n{'='*60}")
        logger.info(f"Batch complete: {success_count}/{len(items)} flashcards created")
        logger.info(f"{'='*60}\n")

        return success_count

    def generate_all(self) -> int:
        """
        Generate flashcards for all vocabulary items
        Returns: Total number of flashcards created
        """
        total = 0
        batch_size = 10

        while True:
            count = self.generate_batch(batch_size)
            total += count

            if count < batch_size:
                # No more items to process
                break

        logger.info(f"\nAll done! Generated {total} flashcards total")
        return total


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(description='Generate flashcards using Gemini')
    parser.add_argument('--db', default=str(DB_PATH), help='Database path')
    parser.add_argument('--batch', type=int, default=10,
                       help='Batch size (default: 10)')
    parser.add_argument('--all', action='store_true',
                       help='Generate flashcards for all vocabulary')

    args = parser.parse_args()

    # Check if GEMINI_API_KEY is set
    import os
    if not os.getenv('GEMINI_API_KEY'):
        logger.error("GEMINI_API_KEY environment variable not set!")
        logger.error("Please set it with: export GEMINI_API_KEY='your-key-here'")
        sys.exit(1)

    with FlashcardGenerator(db_path=args.db) as generator:
        if args.all:
            generator.generate_all()
        else:
            generator.generate_batch(batch_size=args.batch)


if __name__ == '__main__':
    main()
