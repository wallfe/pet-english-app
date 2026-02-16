"""
HTML parsers for BBC Learning English pages
"""
import re
from typing import List, Dict, Any, Optional, Tuple
from bs4 import BeautifulSoup, Tag
import logging

from scraper.config import SESSION_TYPE_PATTERNS

logger = logging.getLogger(__name__)


class BBCParser:
    """Parse BBC Learning English pages"""

    @staticmethod
    def extract_session_links(html: str, base_url: str) -> List[Dict[str, Any]]:
        """
        Extract all session links from a unit page
        Returns: [{"session_number": 1, "url": "...", "title": "..."}, ...]
        """
        soup = BeautifulSoup(html, 'lxml')
        sessions = []

        # Look for session links (pattern: /session-{N})
        session_pattern = re.compile(r'/session-(\d+)$')

        for link in soup.find_all('a', href=True):
            href = link['href']
            match = session_pattern.search(href)

            if match:
                session_number = int(match.group(1))
                full_url = href if href.startswith('http') else f"{base_url}{href}"
                title = link.get_text(strip=True)

                sessions.append({
                    'session_number': session_number,
                    'url': full_url,
                    'title': title
                })

        # Remove duplicates and sort by session number
        sessions = list({s['session_number']: s for s in sessions}.values())
        sessions.sort(key=lambda x: x['session_number'])

        return sessions

    @staticmethod
    def extract_activity_links(html: str, base_url: str) -> List[Dict[str, Any]]:
        """
        Extract all activity links from a session page
        Returns: [{"activity_number": 1, "url": "...", "title": "..."}, ...]
        """
        soup = BeautifulSoup(html, 'lxml')
        activities = []

        # Look for activity links (pattern: /activity-{K})
        activity_pattern = re.compile(r'/activity-(\d+)$')

        for link in soup.find_all('a', href=True):
            href = link['href']
            match = activity_pattern.search(href)

            if match:
                activity_number = int(match.group(1))
                full_url = href if href.startswith('http') else f"{base_url}{href}"
                title = link.get_text(strip=True)

                activities.append({
                    'activity_number': activity_number,
                    'url': full_url,
                    'title': title
                })

        # Remove duplicates and sort by activity number
        activities = list({a['activity_number']: a for a in activities}.values())
        activities.sort(key=lambda x: x['activity_number'])

        return activities

    @staticmethod
    def detect_session_type(html: str, title: str = "") -> str:
        """
        Detect session type from page content
        Returns: 'vocabulary', 'grammar', 'reading', 'listening', 'drama', 'quiz', or 'unknown'
        """
        content = f"{title} {html}".lower()

        for session_type, keywords in SESSION_TYPE_PATTERNS.items():
            if any(keyword.lower() in content for keyword in keywords):
                return session_type

        logger.warning(f"Could not determine session type from content")
        return "unknown"

    @staticmethod
    def extract_transcript(html: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract transcript HTML and text
        Returns: (transcript_html, transcript_text)
        """
        soup = BeautifulSoup(html, 'lxml')

        # Look for transcript container (various possible class names)
        transcript_selectors = [
            '.transcript',
            '#transcript',
            '[class*="transcript"]',
            '[id*="transcript"]'
        ]

        transcript_elem = None
        for selector in transcript_selectors:
            transcript_elem = soup.select_one(selector)
            if transcript_elem:
                break

        if not transcript_elem:
            return None, None

        transcript_html = str(transcript_elem)
        transcript_text = transcript_elem.get_text(separator='\n', strip=True)

        return transcript_html, transcript_text

    @staticmethod
    def extract_audio_url(html: str) -> Optional[str]:
        """Extract audio MP3 URL from page"""
        soup = BeautifulSoup(html, 'lxml')

        # Look for audio elements
        audio_elem = soup.find('audio')
        if audio_elem:
            source = audio_elem.find('source')
            if source and source.get('src'):
                return source['src']

        # Look for download links
        for link in soup.find_all('a', href=True):
            if '.mp3' in link['href']:
                return link['href']

        return None

    @staticmethod
    def extract_bold_words(html: str) -> List[Dict[str, str]]:
        """
        Extract bold words from content with context
        Returns: [{"word": "...", "context": "..."}, ...]
        """
        soup = BeautifulSoup(html, 'lxml')
        bold_words = []

        for tag in soup.find_all(['b', 'strong']):
            word = tag.get_text(strip=True)
            if not word:
                continue

            # Get parent sentence as context
            parent = tag.parent
            if parent:
                context = parent.get_text(strip=True)
            else:
                context = word

            bold_words.append({
                'word': word,
                'context': context
            })

        return bold_words

    @staticmethod
    def extract_session_vocabulary(html: str) -> List[Dict[str, Any]]:
        """
        Extract session vocabulary from sidebar
        Returns vocabulary items in one of two formats:

        Format A (grammar/vocabulary rules):
        [{"rule": "...", "example": "...", "section_title": "..."}, ...]

        Format B (word definitions):
        [{"word": "...", "definition": "..."}, ...]
        """
        soup = BeautifulSoup(html, 'lxml')
        vocabulary = []

        # Look for vocabulary sidebar (various possible selectors)
        vocab_selectors = [
            '.vocabulary',
            '#vocabulary',
            '[class*="vocabulary"]',
            '.sidebar',
            '[class*="sidebar"]'
        ]

        vocab_container = None
        for selector in vocab_selectors:
            vocab_container = soup.select_one(selector)
            if vocab_container:
                break

        if not vocab_container:
            return []

        # Try to detect format and extract accordingly
        # Format A: Rules with examples (grammar/vocabulary sessions)
        rule_items = vocab_container.find_all(['li', 'p'])

        for item in rule_items:
            text = item.get_text(strip=True)
            if not text:
                continue

            # Check if it contains a rule pattern (e.g., "adjective + noun")
            if '→' in text or '—' in text or '+' in text:
                # Format A: rule → example
                parts = re.split(r'[→—]', text, 1)
                if len(parts) == 2:
                    rule = parts[0].strip()
                    example_text = parts[1].strip()

                    # Extract bold example
                    bold = item.find(['b', 'strong'])
                    example = bold.get_text(strip=True) if bold else example_text

                    vocabulary.append({
                        'rule': rule,
                        'example': example,
                        'is_example': True
                    })
            else:
                # Format B: word — definition
                parts = re.split(r'[—–]', text, 1)
                if len(parts) == 2:
                    word = parts[0].strip()
                    definition = parts[1].strip()

                    # Remove ** markdown if present
                    word = re.sub(r'\*\*', '', word)

                    vocabulary.append({
                        'word': word,
                        'definition': definition
                    })
                elif item.find(['b', 'strong']):
                    # Word is bold, rest is definition
                    bold = item.find(['b', 'strong'])
                    word = bold.get_text(strip=True)
                    definition = text.replace(word, '').strip()

                    vocabulary.append({
                        'word': word,
                        'definition': definition
                    })

        return vocabulary

    @staticmethod
    def extract_activity_content(html: str) -> Dict[str, Any]:
        """
        Extract main content from activity page
        Returns: {
            "title": str,
            "instruction": str,
            "content_html": str,
            "content_text": str,
            "has_audio": bool,
            "audio_url": str | None,
            "has_transcript": bool,
            "transcript_html": str | None,
            "transcript_text": str | None,
            "session_vocabulary": List[Dict],
            "bold_words": List[Dict]
        }
        """
        soup = BeautifulSoup(html, 'lxml')

        # Extract title
        title_elem = soup.find(['h1', 'h2'])
        title = title_elem.get_text(strip=True) if title_elem else ""

        # Extract instruction
        instruction = ""
        instruction_selectors = ['.instruction', '[class*="instruction"]', 'p']
        for selector in instruction_selectors:
            elem = soup.select_one(selector)
            if elem:
                text = elem.get_text(strip=True)
                if any(keyword in text.lower() for keyword in ['listen', 'read', 'complete']):
                    instruction = text
                    break

        # Extract main content (excluding transcript and sidebar)
        main_content = soup.find('main') or soup.find('article') or soup.find('body')
        content_html = str(main_content) if main_content else html
        content_text = main_content.get_text(separator='\n', strip=True) if main_content else ""

        # Extract audio
        audio_url = BBCParser.extract_audio_url(html)
        has_audio = bool(audio_url)

        # Extract transcript
        transcript_html, transcript_text = BBCParser.extract_transcript(html)
        has_transcript = bool(transcript_html)

        # Extract session vocabulary
        session_vocabulary = BBCParser.extract_session_vocabulary(html)

        # Extract bold words
        bold_words = BBCParser.extract_bold_words(content_html)

        return {
            'title': title,
            'instruction': instruction,
            'content_html': content_html,
            'content_text': content_text,
            'has_audio': has_audio,
            'audio_url': audio_url,
            'has_transcript': has_transcript,
            'transcript_html': transcript_html,
            'transcript_text': transcript_text,
            'session_vocabulary': session_vocabulary,
            'bold_words': bold_words
        }

    @staticmethod
    def extract_downloads(html: str) -> List[Dict[str, Any]]:
        """
        Extract download resources from downloads page
        Returns: [{
            "resource_title": str,
            "session_number": int,
            "activity_number": int,
            "audio_url": str,
            "audio_size": str,
            "transcript_url": str
        }, ...]
        """
        soup = BeautifulSoup(html, 'lxml')
        downloads = []

        # Look for download sections
        download_sections = soup.find_all(['div', 'li'], class_=re.compile(r'download|resource'))

        for section in download_sections:
            resource = {}

            # Extract title
            title_elem = section.find(['h3', 'h4', 'strong'])
            if title_elem:
                resource['resource_title'] = title_elem.get_text(strip=True)

            # Extract session/activity numbers from title or metadata
            text = section.get_text()
            session_match = re.search(r'Session\s+(\d+)', text, re.I)
            activity_match = re.search(r'Activity\s+(\d+)', text, re.I)

            if session_match:
                resource['session_number'] = int(session_match.group(1))
            if activity_match:
                resource['activity_number'] = int(activity_match.group(1))

            # Extract audio download link
            audio_link = section.find('a', href=re.compile(r'\.mp3'))
            if audio_link:
                resource['audio_url'] = audio_link['href']
                # Extract file size if present
                size_text = audio_link.get_text()
                size_match = re.search(r'([\d.]+\s*[KMG]B)', size_text, re.I)
                if size_match:
                    resource['audio_size'] = size_match.group(1)

            # Extract transcript download link
            transcript_link = section.find('a', text=re.compile(r'transcript', re.I))
            if transcript_link:
                resource['transcript_url'] = transcript_link.get('href')

            if resource.get('resource_title'):
                downloads.append(resource)

        return downloads
