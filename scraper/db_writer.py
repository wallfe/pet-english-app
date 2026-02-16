"""
Database writer for BBC Learning English scraper
"""
import sqlite3
import json
from typing import Optional, Dict, List, Any
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class BBCDatabaseWriter:
    """Handles all database writes for scraped content"""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

    def close(self):
        """Close database connection"""
        self.conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    # ========== Unit Operations ==========

    def insert_unit(self, level_id: str, unit_number: int, title: str,
                    description: str = None, url: str = None, downloads_url: str = None) -> int:
        """Insert or update a unit, return unit_id"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO units (level_id, unit_number, title, description, url, downloads_url)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(level_id, unit_number) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                url = excluded.url,
                downloads_url = excluded.downloads_url
        """, (level_id, unit_number, title, description, url, downloads_url))
        self.conn.commit()

        cursor.execute("SELECT unit_id FROM units WHERE level_id = ? AND unit_number = ?",
                       (level_id, unit_number))
        return cursor.fetchone()[0]

    def get_unit_id(self, level_id: str, unit_number: int) -> Optional[int]:
        """Get unit_id for a given level and unit number"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT unit_id FROM units WHERE level_id = ? AND unit_number = ?",
                       (level_id, unit_number))
        row = cursor.fetchone()
        return row[0] if row else None

    # ========== Session Operations ==========

    def insert_session(self, unit_id: int, session_number: int, session_type: str,
                       title: str = None, url: str = None, audio_url: str = None,
                       transcript_html: str = None, transcript_text: str = None) -> int:
        """Insert or update a session, return session_id"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO sessions (unit_id, session_number, type, title, url, audio_url,
                                 transcript_html, transcript_text)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(unit_id, session_number) DO UPDATE SET
                type = excluded.type,
                title = excluded.title,
                url = excluded.url,
                audio_url = excluded.audio_url,
                transcript_html = excluded.transcript_html,
                transcript_text = excluded.transcript_text
        """, (unit_id, session_number, session_type, title, url, audio_url,
              transcript_html, transcript_text))
        self.conn.commit()

        cursor.execute("SELECT session_id FROM sessions WHERE unit_id = ? AND session_number = ?",
                       (unit_id, session_number))
        return cursor.fetchone()[0]

    def get_session_id(self, unit_id: int, session_number: int) -> Optional[int]:
        """Get session_id for a given unit and session number"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT session_id FROM sessions WHERE unit_id = ? AND session_number = ?",
                       (unit_id, session_number))
        row = cursor.fetchone()
        return row[0] if row else None

    # ========== Activity Operations ==========

    def insert_activity(self, session_id: int, activity_number: int, title: str = None,
                        instruction: str = None, url: str = None, content_html: str = None,
                        content_text: str = None, has_audio: bool = False, audio_url: str = None,
                        has_transcript: bool = False, transcript_html: str = None,
                        transcript_text: str = None) -> int:
        """Insert or update an activity, return activity_id"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO activities (session_id, activity_number, title, instruction, url,
                                   content_html, content_text, has_audio, audio_url,
                                   has_transcript, transcript_html, transcript_text)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id, activity_number) DO UPDATE SET
                title = excluded.title,
                instruction = excluded.instruction,
                url = excluded.url,
                content_html = excluded.content_html,
                content_text = excluded.content_text,
                has_audio = excluded.has_audio,
                audio_url = excluded.audio_url,
                has_transcript = excluded.has_transcript,
                transcript_html = excluded.transcript_html,
                transcript_text = excluded.transcript_text
        """, (session_id, activity_number, title, instruction, url, content_html, content_text,
              has_audio, audio_url, has_transcript, transcript_html, transcript_text))
        self.conn.commit()

        cursor.execute("SELECT activity_id FROM activities WHERE session_id = ? AND activity_number = ?",
                       (session_id, activity_number))
        return cursor.fetchone()[0]

    # ========== Vocabulary Operations ==========

    def insert_session_vocabulary(self, session_id: int, items: List[Dict[str, Any]]):
        """Insert session vocabulary items"""
        cursor = self.conn.cursor()

        # Clear existing vocabulary for this session
        cursor.execute("DELETE FROM session_vocabulary WHERE session_id = ?", (session_id,))

        # Insert new items
        for i, item in enumerate(items):
            cursor.execute("""
                INSERT INTO session_vocabulary
                (session_id, section_title, word, definition, rule, is_example, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                session_id,
                item.get('section_title'),
                item.get('word'),
                item.get('definition'),
                item.get('rule'),
                item.get('is_example', False),
                i
            ))

        self.conn.commit()

    def insert_bold_words(self, activity_id: int, words: List[Dict[str, str]]):
        """Insert bold words from activity content"""
        cursor = self.conn.cursor()

        # Clear existing bold words for this activity
        cursor.execute("DELETE FROM bold_words WHERE activity_id = ?", (activity_id,))

        # Insert new words
        for word_data in words:
            cursor.execute("""
                INSERT INTO bold_words (activity_id, word, context_sentence)
                VALUES (?, ?, ?)
            """, (activity_id, word_data.get('word'), word_data.get('context')))

        self.conn.commit()

    # ========== Downloads Operations ==========

    def insert_download(self, unit_id: int, resource_title: str, session_number: int = None,
                        activity_number: int = None, audio_url: str = None, audio_size: str = None,
                        transcript_url: str = None, local_audio_path: str = None,
                        local_transcript_path: str = None) -> int:
        """Insert a download resource"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO downloads
            (unit_id, resource_title, session_number, activity_number, audio_url, audio_size,
             transcript_url, local_audio_path, local_transcript_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (unit_id, resource_title, session_number, activity_number, audio_url, audio_size,
              transcript_url, local_audio_path, local_transcript_path))
        self.conn.commit()
        return cursor.lastrowid

    def url_exists(self, url: str) -> bool:
        """Check if a URL has already been scraped"""
        cursor = self.conn.cursor()

        # Check in units, sessions, and activities
        for table in ['units', 'sessions', 'activities']:
            cursor.execute(f"SELECT 1 FROM {table} WHERE url = ? LIMIT 1", (url,))
            if cursor.fetchone():
                return True

        return False

    def get_scraping_stats(self) -> Dict[str, int]:
        """Get statistics about scraped content"""
        cursor = self.conn.cursor()

        stats = {}
        tables = ['units', 'sessions', 'activities', 'session_vocabulary',
                  'bold_words', 'downloads']

        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            stats[table] = cursor.fetchone()[0]

        return stats
