# Deployment Guide to HuggingFace

## Overview

This project is deployed in two parts:
1. **HuggingFace Dataset**: Stores the scraped `bbc_learning.db`
2. **HuggingFace Space**: Hosts the web application

## Step 1: Scrape and Generate Content (Local)

### 1.1 Initialize Database
```bash
python3 schema/init_db.py
```

### 1.2 Install Dependencies
```bash
# Install Python dependencies
pip3 install -r requirements.txt

# Install Playwright
playwright install chromium

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 1.3 Run Scraper (Optional - test with one unit first)
```bash
# Test with Unit 1
python3 -m scraper.bbc_scraper --level intermediate --unit 1

# After successful test, scrape all
python3 -m scraper.bbc_scraper --level intermediate --all
python3 -m scraper.bbc_scraper --level lower-intermediate --all
```

### 1.4 Generate AI Content with Gemini
```bash
# Set your Gemini API key
export GEMINI_API_KEY='your-gemini-api-key-here'

# Generate flashcards
python3 -m gemini_generator.flashcard_generator --all

# Generate exercises
python3 -m gemini_generator.exercise_generator --all
```

Result: `data/bbc_learning.db` is now ready!

## Step 2: Upload Database to HuggingFace Dataset

### 2.1 Create Dataset Repository
1. Go to https://huggingface.co/new-dataset
2. Create a new dataset (e.g., `your-username/bbc-learning-english`)
3. Choose: **Public** or **Private**

### 2.2 Upload Database
```bash
# Method 1: Web Upload
# Go to your dataset page → Files → Upload files → Select bbc_learning.db

# Method 2: Git LFS
git clone https://huggingface.co/datasets/your-username/bbc-learning-english
cd bbc-learning-english
cp /path/to/pet-english-app/data/bbc_learning.db .
git add bbc_learning.db
git commit -m "Add BBC Learning English database"
git push
```

## Step 3: Deploy to HuggingFace Space

### 3.1 Create Space
1. Go to https://huggingface.co/new-space
2. Space name: `bbc-learning-english` (or your choice)
3. SDK: **Docker**
4. Choose: **Public** or **Private**

### 3.2 Clone and Push Code
```bash
# Clone your new Space
git clone https://huggingface.co/spaces/your-username/bbc-learning-english
cd bbc-learning-english

# Copy all project files
cp -r /path/to/pet-english-app/* .

# IMPORTANT: Do NOT copy the database (it will be downloaded from Dataset)
rm -f data/bbc_learning.db

# Commit and push
git add .
git commit -m "Initial deployment: BBC Learning English Platform"
git push
```

### 3.3 Configure Space Secrets
1. Go to your Space settings: https://huggingface.co/spaces/your-username/bbc-learning-english/settings
2. Navigate to **Variables and secrets**
3. Add the following secrets:
   - Key: `HF_DATASET_ID`, Value: `your-username/bbc-learning-english`
   - Key: `HF_TOKEN`, Value: (your HuggingFace token - only if dataset is private)

To get your HF token:
- Go to https://huggingface.co/settings/tokens
- Create a token with "Read" permission

### 3.4 Wait for Build
- HuggingFace will automatically build your Docker image
- Check build logs in the "Logs" tab
- Build takes ~5-10 minutes

### 3.5 Access Your App
Once build completes, your app will be live at:
```
https://huggingface.co/spaces/your-username/bbc-learning-english
```

## Troubleshooting

### Database Not Found
- Check that `HF_DATASET_ID` secret is set correctly
- Verify dataset exists and is accessible
- Check Space logs for download errors

### Build Fails
- Check Dockerfile syntax
- Verify requirements.txt has all dependencies
- Check Space logs for specific error messages

### Frontend Not Loading
- Verify frontend was built correctly in Docker
- Check that `/frontend/dist` exists in container
- Verify FastAPI is serving static files

## Local Development

To test locally before deploying:

```bash
# Terminal 1: Backend
cd backend
pip install -r ../requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

Visit: http://localhost:3000

## Updates

To update your deployed Space:

```bash
cd bbc-learning-english-space
# Make changes
git add .
git commit -m "Update: description of changes"
git push
```

HuggingFace will automatically rebuild and redeploy.
