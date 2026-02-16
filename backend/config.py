"""
Backend Configuration
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # App info
    app_name: str = "BBC Learning English Platform"
    app_version: str = "1.0.0"

    # Database
    db_path: str = "data/bbc_learning.db"

    # HuggingFace Dataset
    hf_dataset_id: str = os.getenv("HF_DATASET_ID", "")  # e.g., "username/bbc-learning-english"
    hf_token: str = os.getenv("HF_TOKEN", "")

    # CORS
    cors_origins: list = ["*"]  # Allow all origins for HF Space

    # Paths
    project_root: Path = Path(__file__).parent.parent
    data_dir: Path = project_root / "data"
    audio_dir: Path = data_dir / "audio"

    class Config:
        env_file = ".env"


settings = Settings()

# Ensure directories exist
settings.data_dir.mkdir(parents=True, exist_ok=True)
