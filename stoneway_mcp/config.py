"""Configuration loader for StoneWay MCP Server."""

import os
from pathlib import Path
from typing import Optional


def _load_env_file(filepath: Path) -> None:
    """Lightweight .env parser that doesn't overwrite existing environment variables."""
    if not filepath.is_file():
        return
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = val
    except Exception:
        pass


# Automatically check current directory and parents for .env.local and .env
_current_dir = Path.cwd()
for candidate_dir in [_current_dir, *_current_dir.parents]:
    _load_env_file(candidate_dir / ".env.local")
    _load_env_file(candidate_dir / ".env")


class Settings:
    """StoneWay MCP runtime configuration."""

    @property
    def token(self) -> Optional[str]:
        return os.getenv("STONEWAY_TOKEN")

    @property
    def api_url(self) -> str:
        url = os.getenv("STONEWAY_API_URL", "http://localhost:3000/api/v1")
        return url.rstrip("/")

    @property
    def agent_name(self) -> str:
        return os.getenv("STONEWAY_AGENT_NAME", "stoneway-mcp-agent")

    @property
    def storage_mode(self) -> str:
        """Storage mode: 'remote' (default if token present), 'local', or 'auto'."""
        mode = os.getenv("STONEWAY_STORAGE_MODE", "auto").lower()
        if mode == "auto":
            return "remote" if self.token else "local"
        return mode

    @property
    def local_dir(self) -> Path:
        """Directory for local storage of StoneWay.json and StoneWay.md."""
        custom_path = os.getenv("STONEWAY_LOCAL_DIR")
        if custom_path:
            return Path(custom_path).resolve()
        # Default: current workspace or ~/.stoneway
        if Path("StoneWay.json").exists() or Path("StoneWay.md").exists():
            return Path(".").resolve()
        user_home_dir = Path.home() / ".stoneway"
        user_home_dir.mkdir(parents=True, exist_ok=True)
        return user_home_dir

    @property
    def encryption_key(self) -> Optional[str]:
        return os.getenv("ENCRYPTION_KEY")


settings = Settings()
