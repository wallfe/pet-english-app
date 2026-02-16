#!/usr/bin/env python3
"""
Clean BBC Learning English scraper
- Pure requests + BeautifulSoup (no Playwright needed)
- Transcripts are in the HTML source, hidden by CSS class 'hide'
- Content split across activity-1, activity-2, activity-3 per session
- Audio/PDF links from the unit downloads page
"""
import json
import re
import time
from pathlib import Path
from dataclasses import dataclass, field, asdict
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

# Session type mapping
SESSION_TYPES = {
    1: ("vocabulary", "6 Min Vocabulary"),
    2: ("grammar", "6 Min Grammar"),
    3: ("reading", "阅读"),
    4: ("listening", "听力/实用"),
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
    # Get inner HTML preserving <p>, <strong>, etc.
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
    return titles[:4]  # Only first 4 (one per session)


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
    result["mp3"] = re.findall(r"https?://[^\"\s']+\.mp3", html)
    result["pdf"] = re.findall(r"https?://[^\"\s']+\.pdf", html)
    return result


def scrape_session(unit_num: int, session_num: int) -> dict:
    """Scrape all activities for a session."""
    stype, slabel = SESSION_TYPES.get(session_num, ("other", "Other"))

    transcript = None
    content_blocks = []

    # Fetch activity pages (typically 1-3, sometimes more)
    for act in range(1, 6):
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

        time.sleep(0.5)  # Be polite

    # Combine all content blocks
    combined_content = "\n\n".join(content_blocks) if content_blocks else None

    # Extract keywords from all content
    all_html = (transcript or "") + "\n" + (combined_content or "")
    keywords = extract_keywords_from_html(all_html)
    # Deduplicate while preserving order
    seen = set()
    unique_keywords = []
    for kw in keywords:
        if kw.lower() not in seen:
            seen.add(kw.lower())
            unique_keywords.append(kw)

    return {
        "id": session_num,
        "title": f"Session {session_num}",  # Will be overridden by unit-level titles
        "type": stype,
        "typeLabel": slabel,
        "transcript": transcript,
        "content": combined_content,
        "keyWords": unique_keywords,
    }


def scrape_unit(unit_num: int) -> dict:
    """Scrape a complete unit."""
    print(f"\n{'='*60}")
    print(f"Unit {unit_num}")
    print(f"{'='*60}")

    # Get session titles from unit overview page
    print(f"  Fetching session titles...")
    session_titles = get_session_titles_from_overview(unit_num)
    print(f"  Session titles: {session_titles}")

    # Get downloads
    print(f"  Fetching downloads...")
    downloads = scrape_downloads(unit_num)
    mp3_list = downloads["mp3"]
    print(f"  Found {len(mp3_list)} MP3, {len(downloads['pdf'])} PDF")

    # Get unit title from first session page
    soup = fetch(f"{BASE}/unit-{unit_num}/session-1/activity-1")
    unit_title = get_unit_title(soup, unit_num) if soup else f"Unit {unit_num}"

    sessions = []
    for s in range(1, 5):
        print(f"\n  Session {s}:")
        session = scrape_session(unit_num, s)

        # Set session title from overview
        if s - 1 < len(session_titles):
            session["title"] = session_titles[s - 1]

        # Match audio URL to session
        audio_url = None
        if s == 1:  # vocab
            for url in mp3_list:
                if "vocab" in url.lower():
                    audio_url = url
                    break
        elif s == 2:  # grammar
            for url in mp3_list:
                if "gram" in url.lower():
                    audio_url = url
                    break
        elif s == 4:  # listening
            for url in mp3_list:
                if "vocab" not in url.lower() and "gram" not in url.lower():
                    audio_url = url
                    break

        session["audioUrl"] = audio_url

        has_t = "yes" if session["transcript"] else "no"
        has_c = "yes" if session["content"] else "no"
        kw_count = len(session["keyWords"])
        print(f"    Title: {session['title']}")
        print(f"    Transcript: {has_t}, Content: {has_c}, Keywords: {kw_count}")
        if audio_url:
            print(f"    Audio: {audio_url.split('/')[-1]}")

        sessions.append(session)
        time.sleep(0.5)

    return {
        "id": unit_num,
        "title": unit_title,
        "sessions": sessions,
    }


def main():
    print("BBC Learning English - Clean Scraper")
    print("=" * 60)
    print("Using requests + BeautifulSoup (no browser needed)")
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

    # Save combined file
    combined_file = OUT_DIR.parent / "all_units.json"
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
    print(f"  Output: {OUT_DIR}")


if __name__ == "__main__":
    main()
