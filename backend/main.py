"""
BBC Learning English Platform - FastAPI Backend
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from backend.config import settings
from backend.services.hf_dataset import HFDatasetService

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup: Download database from HF Dataset
    logger.info("Starting up...")

    if settings.hf_dataset_id:
        hf_service = HFDatasetService(
            dataset_id=settings.hf_dataset_id,
            token=settings.hf_token
        )

        logger.info(f"Downloading database from HF Dataset: {settings.hf_dataset_id}")
        success = hf_service.download_database(settings.db_path)

        if success:
            logger.info("✓ Database ready")
        else:
            logger.warning("Failed to download database from HF Dataset")
            logger.warning("Will use local database if available")

    else:
        logger.info("HF_DATASET_ID not set, using local database")

    # Check if database exists
    db_file = Path(settings.db_path)
    if not db_file.exists():
        logger.error(f"Database not found at {settings.db_path}!")
        logger.error("Please set HF_DATASET_ID or provide a local database")

    yield

    # Shutdown
    logger.info("Shutting down...")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers
from backend.routers import courses, vocabulary, exercises, progress

# Include routers
app.include_router(courses.router, prefix="/api/courses", tags=["Courses"])
app.include_router(vocabulary.router, prefix="/api/vocabulary", tags=["Vocabulary"])
app.include_router(exercises.router, prefix="/api/exercises", tags=["Exercises"])
app.include_router(progress.router, prefix="/api/progress", tags=["Progress"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    db_exists = Path(settings.db_path).exists()

    return {
        "status": "ok" if db_exists else "error",
        "database": "ready" if db_exists else "missing",
        "version": settings.app_version
    }


# Serve frontend static files (for production / HF Spaces)
STATIC_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA"""
        file = STATIC_DIR / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(STATIC_DIR / "index.html")
