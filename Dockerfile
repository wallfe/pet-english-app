# Multi-stage Dockerfile for HuggingFace Space deployment

# Stage 1: Build frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Copy frontend files
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend with frontend
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ ./backend/
COPY schema/ ./schema/
COPY gemini_generator/ ./gemini_generator/
COPY scraper/ ./scraper/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create data directory
RUN mkdir -p data

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=7860

# Expose port (HF Spaces use 7860)
EXPOSE 7860

# Run the application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
