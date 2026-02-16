#!/usr/bin/env python3
"""
BBC Learning English Scraper
Main scraping logic using Playwright
"""
import argparse
import asyncio
import logging
import sys
import time
from pathlib import Path
from typing import Optional, List, Dict, Any

from playwright.async_api import async_playwright, Page, Browser
import requests

from scraper.config import (
    get_level_url, get_unit_url, get_downloads_url,
    get_random_delay, USER_AGENT, MAX_RETRIES,
    AUDIO_DIR, TRANSCRIPT_DIR, LOG_DIR, DB_PATH
)
from scraper.parsers import BBCParser
from scraper.db_writer import BBCDatabaseWriter

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'scraper.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class BBCScraper:
    """Main scraper class"""

    def __init__(self, db_path: str = str(DB_PATH), download_audio: bool = True):
        self.db_path = db_path
        self.download_audio = download_audio
        self.db = BBCDatabaseWriter(db_path)
        self.parser = BBCParser()
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None

    async def __aenter__(self):
        """Async context manager entry"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
        self.page = await self.browser.new_page(user_agent=USER_AGENT)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.page:
            await self.page.close()
        if self.browser:
            await self.browser.close()
        self.db.close()

    async def fetch_page(self, url: str, retries: int = MAX_RETRIES) -> Optional[str]:
        """Fetch a page with retry logic"""
        for attempt in range(retries):
            try:
                logger.info(f"Fetching: {url} (attempt {attempt + 1}/{retries})")
                await self.page.goto(url, wait_until='networkidle', timeout=30000)

                # Wait for main content to load
                await self.page.wait_for_selector('main, article, body', timeout=10000)

                # Random delay to be polite
                await asyncio.sleep(get_random_delay())

                return await self.page.content()

            except Exception as e:
                logger.error(f"Error fetching {url}: {e}")
                if attempt < retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff
                    logger.info(f"Retrying in {wait_time} seconds...")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"Failed to fetch {url} after {retries} attempts")
                    return None

    async def scrape_unit(self, level: str, unit_number: int) -> bool:
        """
        Scrape a complete unit
        Returns: True if successful, False otherwise
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"Scraping {level.upper()} - Unit {unit_number}")
        logger.info(f"{'='*60}\n")

        unit_url = get_unit_url(level, unit_number)
        downloads_url = get_downloads_url(level, unit_number)

        # Check if already scraped
        if self.db.url_exists(unit_url):
            logger.info(f"Unit {unit_number} already scraped, skipping...")
            return True

        # Fetch unit page
        unit_html = await self.fetch_page(unit_url)
        if not unit_html:
            return False

        # Extract unit metadata
        unit_title = f"Unit {unit_number}"  # Will be improved with actual title extraction

        # Insert unit into database
        unit_id = self.db.insert_unit(
            level_id=level,
            unit_number=unit_number,
            title=unit_title,
            url=unit_url,
            downloads_url=downloads_url
        )

        logger.info(f"✓ Created unit record (ID: {unit_id})")

        # Extract session links
        sessions = self.parser.extract_session_links(unit_html, unit_url)
        logger.info(f"Found {len(sessions)} sessions")

        # Scrape each session
        for session in sessions:
            success = await self.scrape_session(
                unit_id=unit_id,
                level=level,
                unit_number=unit_number,
                session_number=session['session_number'],
                session_url=session['url']
            )

            if not success:
                logger.warning(f"Failed to scrape session {session['session_number']}")

        # Scrape downloads page
        if self.download_audio:
            await self.scrape_downloads(unit_id, level, unit_number, downloads_url)

        # Print statistics
        stats = self.db.get_scraping_stats()
        logger.info(f"\n{'='*60}")
        logger.info(f"Unit {unit_number} completed!")
        logger.info(f"  Sessions: {stats['sessions']}")
        logger.info(f"  Activities: {stats['activities']}")
        logger.info(f"  Vocabulary items: {stats['session_vocabulary']}")
        logger.info(f"  Bold words: {stats['bold_words']}")
        logger.info(f"  Downloads: {stats['downloads']}")
        logger.info(f"{'='*60}\n")

        return True

    async def scrape_session(self, unit_id: int, level: str, unit_number: int,
                            session_number: int, session_url: str) -> bool:
        """Scrape a session and its activities"""
        logger.info(f"  Session {session_number}: {session_url}")

        # Check if already scraped
        if self.db.url_exists(session_url):
            logger.info(f"    Already scraped, skipping...")
            return True

        # Fetch session page
        session_html = await self.fetch_page(session_url)
        if not session_html:
            return False

        # Detect session type
        session_type = self.parser.detect_session_type(session_html)
        logger.info(f"    Type: {session_type}")

        # Extract session metadata
        session_title = f"Session {session_number}"

        # Insert session into database
        session_id = self.db.insert_session(
            unit_id=unit_id,
            session_number=session_number,
            session_type=session_type,
            title=session_title,
            url=session_url
        )

        # Extract activity links
        activities = self.parser.extract_activity_links(session_html, session_url)
        logger.info(f"    Found {len(activities)} activities")

        # Scrape each activity
        for activity in activities:
            success = await self.scrape_activity(
                session_id=session_id,
                activity_number=activity['activity_number'],
                activity_url=activity['url']
            )

            if not success:
                logger.warning(f"Failed to scrape activity {activity['activity_number']}")

        return True

    async def scrape_activity(self, session_id: int, activity_number: int,
                             activity_url: str) -> bool:
        """Scrape a single activity"""
        logger.info(f"      Activity {activity_number}")

        # Check if already scraped
        if self.db.url_exists(activity_url):
            logger.info(f"        Already scraped, skipping...")
            return True

        # Fetch activity page
        activity_html = await self.fetch_page(activity_url)
        if not activity_html:
            return False

        # Extract activity content
        content = self.parser.extract_activity_content(activity_html)

        # Insert activity into database
        activity_id = self.db.insert_activity(
            session_id=session_id,
            activity_number=activity_number,
            title=content['title'],
            instruction=content['instruction'],
            url=activity_url,
            content_html=content['content_html'],
            content_text=content['content_text'],
            has_audio=content['has_audio'],
            audio_url=content['audio_url'],
            has_transcript=content['has_transcript'],
            transcript_html=content['transcript_html'],
            transcript_text=content['transcript_text']
        )

        # Insert session vocabulary
        if content['session_vocabulary']:
            self.db.insert_session_vocabulary(session_id, content['session_vocabulary'])
            logger.info(f"        ✓ {len(content['session_vocabulary'])} vocabulary items")

        # Insert bold words
        if content['bold_words']:
            self.db.insert_bold_words(activity_id, content['bold_words'])
            logger.info(f"        ✓ {len(content['bold_words'])} bold words")

        return True

    async def scrape_downloads(self, unit_id: int, level: str, unit_number: int,
                              downloads_url: str):
        """Scrape downloads page and download audio files"""
        logger.info(f"\n  Scraping downloads page...")

        downloads_html = await self.fetch_page(downloads_url)
        if not downloads_html:
            return

        # Extract download resources
        downloads = self.parser.extract_downloads(downloads_html)
        logger.info(f"  Found {len(downloads)} download resources")

        for download in downloads:
            # Insert download record
            local_audio_path = None

            if self.download_audio and download.get('audio_url'):
                # Download audio file
                audio_url = download['audio_url']
                filename = f"session-{download.get('session_number', 0)}_activity-{download.get('activity_number', 0)}.mp3"
                local_path = AUDIO_DIR / level / f"unit-{unit_number}" / filename

                if self.download_file(audio_url, local_path):
                    local_audio_path = str(local_path)
                    logger.info(f"    ✓ Downloaded: {filename}")

            self.db.insert_download(
                unit_id=unit_id,
                resource_title=download.get('resource_title', ''),
                session_number=download.get('session_number'),
                activity_number=download.get('activity_number'),
                audio_url=download.get('audio_url'),
                audio_size=download.get('audio_size'),
                transcript_url=download.get('transcript_url'),
                local_audio_path=local_audio_path
            )

    def download_file(self, url: str, local_path: Path, retries: int = MAX_RETRIES) -> bool:
        """Download a file from URL to local path"""
        local_path.parent.mkdir(parents=True, exist_ok=True)

        # Skip if already exists
        if local_path.exists():
            logger.info(f"      File already exists: {local_path.name}")
            return True

        for attempt in range(retries):
            try:
                response = requests.get(url, stream=True, timeout=30)
                response.raise_for_status()

                with open(local_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)

                return True

            except Exception as e:
                logger.error(f"Error downloading {url}: {e}")
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)

        return False

    async def scrape_level(self, level: str, start_unit: int = 1, end_unit: Optional[int] = None):
        """Scrape all units in a level"""
        logger.info(f"\n{'#'*60}")
        logger.info(f"# Scraping {level.upper()} Level")
        logger.info(f"{'#'*60}\n")

        # Determine number of units (11 for intermediate, 30 for lower-intermediate)
        max_units = 11 if level == 'intermediate' else 30

        if end_unit is None:
            end_unit = max_units

        for unit_number in range(start_unit, end_unit + 1):
            success = await self.scrape_unit(level, unit_number)

            if not success:
                logger.error(f"Failed to scrape unit {unit_number}, stopping...")
                break


async def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(description='BBC Learning English Scraper')
    parser.add_argument('--level', choices=['intermediate', 'lower-intermediate'],
                       required=True, help='Course level to scrape')
    parser.add_argument('--unit', type=int, help='Specific unit number to scrape')
    parser.add_argument('--all', action='store_true',
                       help='Scrape all units in the level')
    parser.add_argument('--no-audio', action='store_true',
                       help='Skip downloading audio files')
    parser.add_argument('--db', default=str(DB_PATH),
                       help='Database path (default: data/bbc_learning.db)')
    parser.add_argument('--stats', action='store_true',
                       help='Show scraping statistics and exit')

    args = parser.parse_args()

    # Show stats and exit
    if args.stats:
        db = BBCDatabaseWriter(args.db)
        stats = db.get_scraping_stats()
        print("\nScraping Statistics:")
        print("=" * 40)
        for table, count in stats.items():
            print(f"  {table:20s}: {count:6d}")
        print("=" * 40)
        db.close()
        return

    # Validate arguments
    if not args.unit and not args.all:
        parser.error('Must specify either --unit or --all')

    # Run scraper
    async with BBCScraper(db_path=args.db, download_audio=not args.no_audio) as scraper:
        if args.unit:
            # Scrape single unit
            await scraper.scrape_unit(args.level, args.unit)
        elif args.all:
            # Scrape all units
            await scraper.scrape_level(args.level)


if __name__ == '__main__':
    asyncio.run(main())
