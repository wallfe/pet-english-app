"""
BBC Learning English Scraper Configuration
"""
import random
from pathlib import Path

# Base URL
BASE_URL = "https://www.bbc.co.uk/learningenglish/english/course"

# Supported levels
LEVELS = ["intermediate", "lower-intermediate"]

# Session type detection keywords
SESSION_TYPE_PATTERNS = {
    "vocabulary": ["6 Minute Vocabulary", "vocabulary"],
    "grammar": ["6 Minute Grammar", "grammar"],
    "reading": ["Read the text", "reading"],
    "listening": ["Listen to the audio", "listening", "practical"],
    "drama": ["drama", "episode"],
    "quiz": ["quiz"],
}

# Request settings
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
MIN_DELAY = 2.0  # seconds
MAX_DELAY = 5.0  # seconds
MAX_RETRIES = 3

# File paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
AUDIO_DIR = DATA_DIR / "audio"
TRANSCRIPT_DIR = DATA_DIR / "transcripts"
LOG_DIR = PROJECT_ROOT / "logs"
DB_PATH = DATA_DIR / "bbc_learning.db"

# Ensure directories exist
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

def get_random_delay() -> float:
    """Get random delay between requests"""
    return random.uniform(MIN_DELAY, MAX_DELAY)

def get_level_url(level: str) -> str:
    """Get URL for a course level"""
    return f"{BASE_URL}/{level}"

def get_unit_url(level: str, unit_number: int) -> str:
    """Get URL for a unit"""
    return f"{BASE_URL}/{level}/unit-{unit_number}"

def get_session_url(level: str, unit_number: int, session_number: int) -> str:
    """Get URL for a session"""
    return f"{BASE_URL}/{level}/unit-{unit_number}/session-{session_number}"

def get_activity_url(level: str, unit_number: int, session_number: int, activity_number: int) -> str:
    """Get URL for an activity"""
    return f"{BASE_URL}/{level}/unit-{unit_number}/session-{session_number}/activity-{activity_number}"

def get_downloads_url(level: str, unit_number: int) -> str:
    """Get URL for downloads page"""
    return f"{BASE_URL}/{level}/unit-{unit_number}/downloads"
