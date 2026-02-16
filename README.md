---
title: BBC Learning English PET/FCE Platform
emoji: 📚
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 8000
pinned: false
---

# BBC Learning English - PET/FCE AI Study Platform

AI-powered English learning platform for Cambridge PET (B1) / FCE (B2) exam preparation, powered by BBC Learning English content and Gemini 2.0 Flash.

## Features

- 📖 **Course Browser**: Browse Intermediate and Lower Intermediate courses from BBC Learning English
- 🎴 **Smart Flashcards**: AI-generated vocabulary flashcards with Chinese explanations, using SM-2 spaced repetition algorithm
- ✏️ **PET-Style Exercises**: Practice with authentic Cambridge PET exam-style questions
- 📊 **Progress Tracking**: Monitor your learning progress and achievements
- 🎧 **Audio & Transcripts**: Listen to BBC audio with highlighted vocabulary
- 🤖 **AI-Generated Content**: Child-friendly Chinese explanations powered by Gemini 2.0 Flash

## Architecture

### Local Tools (Not Deployed)
- **BBC Scraper** (Playwright): Scrapes course content from BBC Learning English
- **Gemini Generator**: Generates flashcards and exercises using Gemini 2.0 Flash API
- **Output**: `bbc_learning.db` SQLite database

### Web Application (Deployed to HF Space)
- **Backend**: FastAPI + SQLite
- **Frontend**: React + Vite + TailwindCSS
- **Data Source**: Downloads database from HuggingFace Dataset on startup

## Setup

### Environment Variables

Create a `.env` file:

```bash
# HuggingFace Dataset (required for deployed app)
HF_DATASET_ID=your-username/bbc-learning-english
HF_TOKEN=your-hf-token

# Gemini API (only for local content generation)
GEMINI_API_KEY=your-gemini-api-key
```

### Local Development

1. **Initialize Database**
```bash
python3 schema/init_db.py
```

2. **Run Scraper** (Optional - can use pre-scraped dataset)
```bash
# Install Playwright
pip install -r requirements.txt
playwright install chromium

# Scrape a single unit (pilot)
python3 -m scraper.bbc_scraper --level intermediate --unit 1

# Scrape all units
python3 -m scraper.bbc_scraper --level intermediate --all
```

3. **Generate Content with Gemini** (Optional)
```bash
# Set API key
export GEMINI_API_KEY='your-key-here'

# Generate flashcards
python3 -m gemini_generator.flashcard_generator --all

# Generate exercises
python3 -m gemini_generator.exercise_generator --all
```

4. **Run Development Server**
```bash
# Backend
cd backend
pip install -r ../requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Visit http://localhost:3000

### Production Deployment (HuggingFace Space)

1. **Upload Database to HF Dataset**
```bash
# Create a dataset repository on HuggingFace
# Upload bbc_learning.db to the dataset
```

2. **Deploy to HF Space**
```bash
# Clone your HF Space repository
git clone https://huggingface.co/spaces/your-username/bbc-learning-english

# Copy project files
cp -r * your-space-repo/

# Push to HF
cd your-space-repo
git add .
git commit -m "Initial deployment"
git push
```

3. **Configure Space Secrets**
   - Go to your Space settings on HuggingFace
   - Add secret: `HF_DATASET_ID=your-username/bbc-learning-english`
   - Add secret: `HF_TOKEN=your-hf-token` (if dataset is private)

## Database Schema

- **levels**: Course levels (intermediate, lower-intermediate)
- **units**: Course units
- **sessions**: Learning sessions (vocabulary, grammar, reading, listening, drama, quiz)
- **activities**: Individual learning activities
- **session_vocabulary**: Vocabulary from session sidebars
- **flashcards**: AI-generated flashcards with Chinese translations
- **exercises**: PET-style practice exercises
- **flashcard_progress**: SM-2 spaced repetition progress
- **user_progress**: Activity completion tracking

## Tech Stack

- **Scraping**: Playwright (Python)
- **AI Generation**: Google Gemini 2.0 Flash
- **Backend**: FastAPI, SQLite
- **Frontend**: React 18, Vite, TailwindCSS 3, React Router 6
- **Deployment**: Docker, HuggingFace Spaces

## License

Personal learning project. BBC Learning English content belongs to BBC.

## Acknowledgments

- BBC Learning English for providing excellent learning materials
- Google Gemini 2.0 Flash for AI-powered content generation
- Cambridge Assessment English for PET exam format
