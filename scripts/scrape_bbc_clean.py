#!/usr/bin/env python3
"""
Clean BBC Learning English scraper v2
- Pure requests + BeautifulSoup (no Playwright needed)
- Transcripts are in the HTML source, hidden by CSS class 'hide'
- Content split across activity-1, activity-2, activity-3 per session
- Audio from downloads page + individual activity pages
- Correct TYPE_MAP for S3/S4 (varies by unit)
"""
import json
import re
import time
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

BASE = "https://www.bbc.co.uk/learningenglish/course/intermediate"
DL_BASE = "https://www.bbc.co.uk/learningenglish/english/course/intermediate"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
OUT_DIR = Path(__file__).parent.parent / "data" / "units"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Correct session type mapping per unit
# S1 = vocabulary, S2 = grammar (always)
# S3/S4 vary by unit (reading/listening swap)
TYPE_MAP = {
    1:  {1: ("vocabulary", "6 Min Vocabulary"), 2: ("grammar", "6 Min Grammar"),
         3: ("reading", "阅读"), 4: ("listening", "听力/实用")},
    2:  {1: ("vocabulary", "6 Min Vocabulary"), 2: ("grammar", "6 Min Grammar"),
         3: ("listening", "听力/实用"), 4: ("reading", "阅读")},
    3:  {1: ("vocabulary", "6 Min Vocabulary"), 2: ("grammar", "6 Min Grammar"),
         3: ("reading", "阅读"), 4: ("listening", "听力/实用")},
    4:  {1: ("vocabulary", "6 Min Vocabulary"), 2: ("grammar", "6 Min Grammar"),
         3: ("reading", "阅读"), 4: ("listening", "听力/实用")},
    5:  {1: ("vocabulary", "6 Min Vocabulary"), 2: ("grammar", "6 Min Grammar"),
         3: ("listening", "听力/实用"), 4: ("reading", "阅读")},
    6:  {1: ("vocabulary", "6 Min Vocabulary"), 2: ("grammar", "6 Min Grammar"),
         3: ("reading", "阅读"), 4: ("listening", "听力/实用")},
    7:  {1: ("vocabulary", "6 Min Vocabulary"), 2: ("grammar", "6 Min Grammar"),
         3: ("listening", "听力/实用"), 4: ("reading", "阅读")},
    8:  {1: ("vocabulary", "6 Min Vocabulary"), 2: ("grammar", "6 Min Grammar"),
         3: ("reading", "阅读"), 4: ("listening", "听力/实用")},
    9:  {1: ("vocabulary", "6 Min Vocabulary"), 2: ("grammar", "6 Min Grammar"),
         3: ("listening", "听力/实用"), 4: ("reading", "阅读")},
    10: {1: ("vocabulary", "6 Min Vocabulary"), 2: ("grammar", "6 Min Grammar"),
         3: ("listening", "听力/实用"), 4: ("reading", "阅读")},
}


def fetch(url: str) -> Optional[BeautifulSoup]:
    """Fetch a URL and return parsed soup, or None on failure."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        if r.status_code == 200:
            return BeautifulSoup(r.text, "html.parser")
        print(f"    HTTP {r.status_code}: {url}")
        return None
    except Exception as e:
        print(f"    Error fetching {url}: {e}")
        return None


def extract_transcript(soup: BeautifulSoup) -> Optional[str]:
    """Extract transcript from a hideable widget."""
    widget = soup.find("div", class_="widget-richtext-hideable")
    if not widget:
        return None
    content_div = widget.find("div", class_="widget-richtext")
    if not content_div:
        return None
    html = content_div.decode_contents().strip()
    if len(html) < 50:
        return None
    return html


def extract_richtext_blocks(soup: BeautifulSoup) -> list[str]:
    """Extract standalone richtext blocks (not inside hideable)."""
    blocks = []
    for rt in soup.find_all("div", class_="widget-richtext"):
        if rt.find_parent(class_="widget-richtext-hideable"):
            continue
        html = rt.decode_contents().strip()
        if len(html) > 50:
            blocks.append(html)
    return blocks


def extract_keywords_from_html(html: str) -> list[str]:
    """Extract keywords from bold/strong tags in content."""
    soup = BeautifulSoup(html, "html.parser")
    keywords = []
    for tag in soup.find_all(["strong", "b"]):
        text = tag.get_text(strip=True)
        if text and len(text) > 1 and len(text) < 100:
            keywords.append(text)
    return keywords


def extract_audio_from_page(soup: BeautifulSoup) -> list[str]:
    """Extract audio URLs from a page (audio elements + mp3 links in HTML)."""
    urls = []
    # Check <audio> elements
    for audio in soup.find_all("audio"):
        src = audio.get("src", "")
        if src and ".mp3" in src:
            urls.append(src)
        for source in audio.find_all("source"):
            src = source.get("src", "")
            if src and ".mp3" in src:
                urls.append(src)
    # Also check raw HTML for mp3 links
    html = str(soup)
    mp3s = re.findall(r'https?://[^\"\s\'<>]+\.mp3', html)
    urls.extend(mp3s)
    return list(set(urls))


def get_session_titles_from_overview(unit_num: int) -> list[str]:
    """Get all 4 session titles from the unit overview page."""
    url = f"{BASE}/unit-{unit_num}"
    soup = fetch(url)
    if not soup:
        return []
    titles = []
    for h3 in soup.find_all("h3"):
        text = h3.get_text(strip=True)
        if text and len(text) > 3 and len(text) < 100:
            titles.append(text)
    return titles[:4]


def get_unit_title(soup: BeautifulSoup, unit_num: int) -> str:
    """Extract unit title from page."""
    span = soup.find("span", class_="bbcle-unit-title")
    if span:
        return f"Unit {unit_num}: {span.get_text(strip=True)}"
    return f"Unit {unit_num}"


def scrape_downloads(unit_num: int) -> dict:
    """Get audio and PDF links from the downloads page."""
    url = f"{DL_BASE}/unit-{unit_num}/downloads"
    soup = fetch(url)
    result = {"mp3": [], "pdf": []}
    if not soup:
        return result
    html = str(soup)
    result["mp3"] = list(set(re.findall(r"https?://[^\"\s']+\.mp3", html)))
    result["pdf"] = list(set(re.findall(r"https?://[^\"\s']+\.pdf", html)))
    return result


def scrape_session(unit_num: int, session_num: int) -> dict:
    """Scrape all activities for a session."""
    stype, slabel = TYPE_MAP.get(unit_num, {}).get(
        session_num, ("other", "Other")
    )

    transcript = None
    content_blocks = []
    session_audio = []

    # Fetch activity pages (typically 1-3, sometimes more)
    for act in range(1, 8):
        url = f"{BASE}/unit-{unit_num}/session-{session_num}/activity-{act}"
        soup = fetch(url)
        if not soup:
            break

        # Extract transcript (usually only on activity-1)
        if not transcript:
            t = extract_transcript(soup)
            if t:
                transcript = t

        # Extract content blocks
        blocks = extract_richtext_blocks(soup)
        content_blocks.extend(blocks)

        # Extract audio from individual activity pages
        page_audio = extract_audio_from_page(soup)
        session_audio.extend(page_audio)

        time.sleep(0.5)

    # Combine all content blocks
    combined_content = "\n\n".join(content_blocks) if content_blocks else None

    # Extract keywords from all content
    all_html = (transcript or "") + "\n" + (combined_content or "")
    keywords = extract_keywords_from_html(all_html)
    seen = set()
    unique_keywords = []
    for kw in keywords:
        if kw.lower() not in seen:
            seen.add(kw.lower())
            unique_keywords.append(kw)

    return {
        "id": session_num,
        "title": f"Session {session_num}",
        "type": stype,
        "typeLabel": slabel,
        "transcript": transcript,
        "content": combined_content,
        "keyWords": unique_keywords,
        "_session_audio": list(set(session_audio)),  # temporary, for matching
    }


def match_audio(unit_num: int, sessions: list, download_mp3s: list):
    """Match audio URLs to sessions intelligently."""
    all_mp3s = list(set(download_mp3s))

    # Also collect audio found on individual session pages
    for s in sessions:
        for url in s.get("_session_audio", []):
            if url not in all_mp3s:
                all_mp3s.append(url)

    print(f"  All MP3s found: {len(all_mp3s)}")
    for url in all_mp3s:
        print(f"    {url.split('/')[-1]}")

    # Categorize MP3s
    vocab_mp3s = [u for u in all_mp3s if "vocab" in u.lower()]
    gram_mp3s = [u for u in all_mp3s if "gram" in u.lower()]
    other_mp3s = [u for u in all_mp3s if "vocab" not in u.lower() and "gram" not in u.lower()]

    for s in sessions:
        audio_url = None
        if s["type"] == "vocabulary":
            audio_url = vocab_mp3s[0] if vocab_mp3s else None
        elif s["type"] == "grammar":
            audio_url = gram_mp3s[0] if gram_mp3s else None
        elif s["type"] == "listening":
            # For listening, use the "other" MP3s (not vocab/gram)
            if other_mp3s:
                audio_url = other_mp3s[0]
            # Also check session-specific audio found on activity pages
            elif s.get("_session_audio"):
                for url in s["_session_audio"]:
                    if "vocab" not in url.lower() and "gram" not in url.lower():
                        audio_url = url
                        break

        s["audioUrl"] = audio_url

        # Clean up temp field
        if "_session_audio" in s:
            del s["_session_audio"]


def scrape_unit(unit_num: int) -> dict:
    """Scrape a complete unit."""
    print(f"\n{'='*60}")
    print(f"Unit {unit_num}")
    print(f"{'='*60}")

    print(f"  Fetching session titles...")
    session_titles = get_session_titles_from_overview(unit_num)
    print(f"  Session titles: {session_titles}")

    print(f"  Fetching downloads...")
    downloads = scrape_downloads(unit_num)
    mp3_list = downloads["mp3"]
    print(f"  Downloads: {len(mp3_list)} MP3, {len(downloads['pdf'])} PDF")

    # Get unit title
    soup = fetch(f"{BASE}/unit-{unit_num}/session-1/activity-1")
    unit_title = get_unit_title(soup, unit_num) if soup else f"Unit {unit_num}"

    sessions = []
    for s in range(1, 5):
        print(f"\n  Session {s}:")
        session = scrape_session(unit_num, s)

        # Set session title from overview
        if s - 1 < len(session_titles):
            session["title"] = session_titles[s - 1]

        has_t = "yes" if session["transcript"] else "no"
        has_c = "yes" if session["content"] else "no"
        kw_count = len(session["keyWords"])
        sa_count = len(session.get("_session_audio", []))
        print(f"    Title: {session['title']}")
        print(f"    Type: {session['type']} ({session['typeLabel']})")
        print(f"    Transcript: {has_t}, Content: {has_c}, Keywords: {kw_count}")
        print(f"    Session page audio: {sa_count}")

        sessions.append(session)
        time.sleep(0.5)

    # Match audio to sessions
    print(f"\n  Matching audio...")
    match_audio(unit_num, sessions, mp3_list)

    for s in sessions:
        if s.get("audioUrl"):
            print(f"    S{s['id']} ({s['type']}): {s['audioUrl'].split('/')[-1]}")
        else:
            print(f"    S{s['id']} ({s['type']}): NO AUDIO")

    return {
        "id": unit_num,
        "title": unit_title,
        "sessions": sessions,
    }


def main():
    print("BBC Learning English - Clean Scraper v2")
    print("=" * 60)
    print("Using requests + BeautifulSoup (no browser needed)")
    print("With correct TYPE_MAP and activity page audio search")
    print()

    all_units = {}
    total_transcripts = 0
    total_content = 0
    total_keywords = 0
    total_audio = 0

    for unit_num in range(1, 11):
        unit = scrape_unit(unit_num)
        all_units[unit_num] = unit

        # Save individual unit file
        out_file = OUT_DIR / f"unit-{unit_num}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(unit, f, ensure_ascii=False, indent=2)
        print(f"\n  Saved: {out_file.name}")

        # Stats
        for s in unit["sessions"]:
            if s["transcript"]:
                total_transcripts += 1
            if s["content"]:
                total_content += 1
            total_keywords += len(s["keyWords"])
            if s.get("audioUrl"):
                total_audio += 1

        time.sleep(1)

    # Save combined file for the app
    combined_file = OUT_DIR.parent / "units.json"
    with open(combined_file, "w", encoding="utf-8") as f:
        json.dump(all_units, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("SCRAPING COMPLETE!")
    print("=" * 60)
    print(f"  Units: 10")
    print(f"  Sessions: 40")
    print(f"  Transcripts: {total_transcripts}")
    print(f"  Content blocks: {total_content}")
    print(f"  Keywords: {total_keywords}")
    print(f"  Audio files: {total_audio}")
    print(f"  Output: {combined_file}")

    # Report listening sessions without audio
    print("\n  Listening sessions audio status:")
    for uid, unit in all_units.items():
        for s in unit["sessions"]:
            if s["type"] == "listening":
                status = "OK" if s.get("audioUrl") else "MISSING"
                print(f"    Unit {uid} S{s['id']} ({s['title']}): {status}")


if __name__ == "__main__":
    main()
