"""
Database Service
Handles all database queries for the API
"""
import sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional

from backend.services.sm2 import calculate_next_review


class DatabaseService:
    """Service for database operations"""

    def __init__(self, db_path: str):
        self.db_path = db_path

    def get_connection(self):
        """Get database connection"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # ========== Levels & Units ==========

    def get_levels(self) -> List[Dict[str, Any]]:
        """Get all course levels"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            rows = cursor.execute("""
                SELECT level_id, title, description, total_units
                FROM levels
                ORDER BY level_id
            """).fetchall()

            return [dict(row) for row in rows]

    def get_units(self, level_id: str) -> List[Dict[str, Any]]:
        """Get all units for a level"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            rows = cursor.execute("""
                SELECT unit_id, level_id, unit_number, title, description, url
                FROM units
                WHERE level_id = ?
                ORDER BY unit_number
            """, (level_id,)).fetchall()

            return [dict(row) for row in rows]

    def get_unit(self, unit_id: int) -> Optional[Dict[str, Any]]:
        """Get a single unit by ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            row = cursor.execute("""
                SELECT unit_id, level_id, unit_number, title, description, url
                FROM units
                WHERE unit_id = ?
            """, (unit_id,)).fetchone()

            return dict(row) if row else None

    # ========== Sessions ==========

    def get_sessions(self, unit_id: int) -> List[Dict[str, Any]]:
        """Get all sessions for a unit"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            rows = cursor.execute("""
                SELECT session_id, unit_id, session_number, type, title, url,
                       has_audio, audio_url
                FROM sessions
                WHERE unit_id = ?
                ORDER BY session_number
            """, (unit_id,)).fetchall()

            return [dict(row) for row in rows]

    def get_session(self, session_id: int) -> Optional[Dict[str, Any]]:
        """Get a single session by ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            row = cursor.execute("""
                SELECT *
                FROM sessions
                WHERE session_id = ?
            """, (session_id,)).fetchone()

            return dict(row) if row else None

    # ========== Activities ==========

    def get_activities(self, session_id: int) -> List[Dict[str, Any]]:
        """Get all activities for a session"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            rows = cursor.execute("""
                SELECT activity_id, session_id, activity_number, title,
                       instruction, url, has_audio, has_transcript
                FROM activities
                WHERE session_id = ?
                ORDER BY activity_number
            """, (session_id,)).fetchall()

            return [dict(row) for row in rows]

    def get_activity(self, activity_id: int) -> Optional[Dict[str, Any]]:
        """Get a single activity by ID with full content"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            row = cursor.execute("""
                SELECT *
                FROM activities
                WHERE activity_id = ?
            """, (activity_id,)).fetchone()

            return dict(row) if row else None

    # ========== Vocabulary ==========

    def get_session_vocabulary(self, session_id: int) -> List[Dict[str, Any]]:
        """Get vocabulary items for a session"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            rows = cursor.execute("""
                SELECT vocab_id, word, definition, rule, is_example, section_title
                FROM session_vocabulary
                WHERE session_id = ?
                ORDER BY sort_order
            """, (session_id,)).fetchall()

            return [dict(row) for row in rows]

    # ========== Flashcards ==========

    def get_flashcards(self, limit: Optional[int] = None,
                      difficulty: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get flashcards with optional filters"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            query = """
                SELECT
                    f.card_id, f.word, f.definition_en, f.definition_cn,
                    f.example_en, f.example_cn, f.difficulty,
                    fp.easiness_factor, fp.repetitions, fp.interval,
                    fp.next_review_date, fp.last_reviewed_at
                FROM flashcards f
                LEFT JOIN flashcard_progress fp ON f.card_id = fp.card_id
            """

            params = []
            if difficulty:
                query += " WHERE f.difficulty = ?"
                params.append(difficulty)

            query += " ORDER BY RANDOM()"

            if limit:
                query += f" LIMIT {limit}"

            rows = cursor.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    def get_due_flashcards(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get flashcards due for review"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            rows = cursor.execute("""
                SELECT
                    f.card_id, f.word, f.definition_en, f.definition_cn,
                    f.example_en, f.example_cn, f.difficulty,
                    fp.easiness_factor, fp.repetitions, fp.interval,
                    fp.next_review_date, fp.last_reviewed_at
                FROM flashcards f
                LEFT JOIN flashcard_progress fp ON f.card_id = fp.card_id
                WHERE fp.next_review_date IS NULL
                   OR fp.next_review_date <= datetime('now')
                ORDER BY fp.next_review_date ASC NULLS FIRST
                LIMIT ?
            """, (limit,)).fetchall()

            return [dict(row) for row in rows]

    def review_flashcard(self, card_id: int, quality: int) -> Dict[str, Any]:
        """
        Record a flashcard review using SM-2 algorithm

        Args:
            card_id: Flashcard ID
            quality: Quality rating (0-5)

        Returns:
            Updated progress data
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Get current progress
            row = cursor.execute("""
                SELECT easiness_factor, repetitions, interval
                FROM flashcard_progress
                WHERE card_id = ?
            """, (card_id,)).fetchone()

            if row:
                ef, reps, interval = row
            else:
                # Initialize progress
                ef, reps, interval = 2.5, 0, 0

            # Calculate next review
            new_ef, new_reps, new_interval, next_review = calculate_next_review(
                quality, ef, reps, interval
            )

            # Update or insert progress
            cursor.execute("""
                INSERT INTO flashcard_progress
                (card_id, easiness_factor, repetitions, interval, next_review_date, last_reviewed_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(card_id) DO UPDATE SET
                    easiness_factor = excluded.easiness_factor,
                    repetitions = excluded.repetitions,
                    interval = excluded.interval,
                    next_review_date = excluded.next_review_date,
                    last_reviewed_at = excluded.last_reviewed_at
            """, (card_id, new_ef, new_reps, new_interval,
                  next_review.isoformat(), datetime.now().isoformat()))

            conn.commit()

            return {
                'card_id': card_id,
                'easiness_factor': new_ef,
                'repetitions': new_reps,
                'interval': new_interval,
                'next_review_date': next_review.isoformat()
            }

    # ========== Exercises ==========

    def get_exercises(self, session_id: Optional[int] = None,
                     exercise_type: Optional[str] = None,
                     limit: int = 10) -> List[Dict[str, Any]]:
        """Get exercises with optional filters"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            query = """
                SELECT exercise_id, session_id, exercise_type, question,
                       options, correct_answer, explanation, difficulty
                FROM exercises
            """

            params = []
            conditions = []

            if session_id:
                conditions.append("session_id = ?")
                params.append(session_id)

            if exercise_type:
                conditions.append("exercise_type = ?")
                params.append(exercise_type)

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += f" ORDER BY RANDOM() LIMIT {limit}"

            rows = cursor.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    def submit_exercise_answer(self, exercise_id: int, user_answer: str) -> Dict[str, Any]:
        """
        Submit an answer to an exercise

        Returns:
            {
                'is_correct': bool,
                'correct_answer': str,
                'explanation': str
            }
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Get exercise
            row = cursor.execute("""
                SELECT correct_answer, explanation
                FROM exercises
                WHERE exercise_id = ?
            """, (exercise_id,)).fetchone()

            if not row:
                return {'error': 'Exercise not found'}

            exercise = dict(row)
            is_correct = user_answer.strip().upper() == exercise['correct_answer'].strip().upper()

            # Record attempt
            cursor.execute("""
                INSERT INTO exercise_attempts (exercise_id, user_answer, is_correct)
                VALUES (?, ?, ?)
            """, (exercise_id, user_answer, is_correct))

            conn.commit()

            return {
                'is_correct': is_correct,
                'correct_answer': exercise['correct_answer'],
                'explanation': exercise['explanation']
            }

    # ========== Progress ==========

    def get_user_progress(self) -> Dict[str, Any]:
        """Get overall user progress statistics"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Count completed activities
            completed_activities = cursor.execute("""
                SELECT COUNT(*) FROM user_progress WHERE completed = 1
            """).fetchone()[0]

            # Total activities
            total_activities = cursor.execute("""
                SELECT COUNT(*) FROM activities
            """).fetchone()[0]

            # Flashcard stats
            flashcard_stats = cursor.execute("""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN next_review_date <= datetime('now') THEN 1 ELSE 0 END) as due
                FROM flashcard_progress
            """).fetchone()

            # Exercise stats
            exercise_stats = cursor.execute("""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
                FROM exercise_attempts
            """).fetchone()

            return {
                'activities': {
                    'completed': completed_activities,
                    'total': total_activities,
                    'percentage': round(completed_activities / total_activities * 100, 1) if total_activities > 0 else 0
                },
                'flashcards': {
                    'reviewed': flashcard_stats[0] if flashcard_stats else 0,
                    'due': flashcard_stats[1] if flashcard_stats else 0
                },
                'exercises': {
                    'attempted': exercise_stats[0] if exercise_stats else 0,
                    'correct': exercise_stats[1] if exercise_stats else 0,
                    'accuracy': round(exercise_stats[1] / exercise_stats[0] * 100, 1) if exercise_stats and exercise_stats[0] > 0 else 0
                }
            }

    def mark_activity_complete(self, activity_id: int) -> bool:
        """Mark an activity as completed"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO user_progress (activity_id, completed, completed_at)
                VALUES (?, 1, ?)
                ON CONFLICT(activity_id) DO UPDATE SET
                    completed = 1,
                    completed_at = excluded.completed_at
            """, (activity_id, datetime.now().isoformat()))

            conn.commit()
            return True
