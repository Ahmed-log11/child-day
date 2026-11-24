"""Model weights. Git never holds them (.gitignore).

Locally: put tablet.pt and violence.pt in backend/weights/ yourself.
On the server: missing files are downloaded from the Hugging Face model repo
(settings.models_repo) when the app starts, then the models are loaded once so the
first upload or live session doesn't wait for them.
"""
import logging
import threading
from pathlib import Path

from app.config import settings

log = logging.getLogger(__name__)

WEIGHTS_DIR = Path(__file__).resolve().parents[1] / "weights"   # backend/weights
FILES = ["tablet.pt", "violence.pt"]


def download_missing() -> None:
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    missing = [name for name in FILES if not (WEIGHTS_DIR / name).exists()]
    if not missing or not settings.models_repo:
        return
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        log.warning("huggingface_hub is not installed, cannot download %s", missing)
        return
    for name in missing:
        try:
            hf_hub_download(repo_id=settings.models_repo, filename=name, local_dir=WEIGHTS_DIR)
            log.info("Downloaded %s from %s", name, settings.models_repo)
        except Exception:
            log.exception("Could not download %s from %s", name, settings.models_repo)


def warm_up() -> None:
    download_missing()
    try:
        from app.pipeline import perception

        perception.load_models()
        log.info("Models loaded")
    except Exception:
        log.exception("Model warm-up failed")


def start_warm_up() -> None:
    """Runs in the background so the server answers requests right away."""
    threading.Thread(target=warm_up, daemon=True).start()
