"""All settings come from environment variables (or a .env file), with safe local defaults."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Empty = local SQLite file. In production, the Supabase Postgres URL.
    database_url: str = ""

    # Where uploads and alert clips go when Supabase Storage is not set.
    storage_dir: Path = BACKEND_DIR / "storage"

    # Supabase Storage (optional)
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_bucket: str = "clips"

    # Frontend origins allowed to call the API
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # While the real pipeline is being built, endpoints return the mock data.
    use_mock_pipeline: bool = True

    # Pipeline settings
    analyzed_fps: float = 3.0

    @property
    def db_url(self) -> str:
        return self.database_url or f"sqlite:///{BACKEND_DIR / 'child_day.db'}"


settings = Settings()
