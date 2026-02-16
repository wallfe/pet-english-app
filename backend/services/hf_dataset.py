"""
HuggingFace Dataset Downloader
Downloads bbc_learning.db from HF Dataset on startup
"""
import logging
from pathlib import Path
from typing import Optional

from huggingface_hub import hf_hub_download, HfApi

logger = logging.getLogger(__name__)


class HFDatasetService:
    """Service for downloading database from HuggingFace Dataset"""

    def __init__(self, dataset_id: str, token: Optional[str] = None):
        self.dataset_id = dataset_id
        self.token = token
        self.api = HfApi()

    def download_database(self, local_path: str = "data/bbc_learning.db") -> bool:
        """
        Download bbc_learning.db from HF Dataset
        Returns: True if successful, False otherwise
        """
        if not self.dataset_id:
            logger.warning("HF_DATASET_ID not set, skipping database download")
            return False

        local_file = Path(local_path)

        # Check if file already exists
        if local_file.exists():
            logger.info(f"Database already exists at {local_path}")
            return True

        logger.info(f"Downloading database from HF Dataset: {self.dataset_id}")

        try:
            # Download file from dataset
            downloaded_path = hf_hub_download(
                repo_id=self.dataset_id,
                filename="bbc_learning.db",
                repo_type="dataset",
                token=self.token,
                local_dir=local_file.parent
            )

            logger.info(f"✓ Database downloaded to: {downloaded_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to download database from HF Dataset: {e}")
            return False

    def check_dataset_exists(self) -> bool:
        """Check if dataset exists on HuggingFace"""
        if not self.dataset_id:
            return False

        try:
            self.api.dataset_info(self.dataset_id, token=self.token)
            return True
        except Exception:
            return False
