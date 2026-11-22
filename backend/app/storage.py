"""Saves uploads and alert clips: local folder by default, Supabase Storage when configured. Owner: P4."""


def save_clip(local_path: str, name: str) -> str:
    """Store a clip and return its URL."""
    raise NotImplementedError
