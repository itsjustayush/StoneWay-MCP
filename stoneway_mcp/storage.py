"""Pluggable storage backend interface for StoneWay MCP.

Supports both Remote Cloud Backend (Next.js + Neon Postgres via REST API)
and Zero-Cloud Local File Backend (reading/writing StoneWay.json and StoneWay.md
directly from workspace or ~/.stoneway).
"""

import abc
import json
from pathlib import Path
from typing import Any, Dict, Optional
from stoneway_mcp.bio_generator import generate_platform_bio
from stoneway_mcp.client import StoneWayClient
from stoneway_mcp.config import settings
from stoneway_mcp.models import (
    STARTER_STONEWAY_MD,
    BioPlatform,
    BioTone,
    ProfileContext,
    StoneWayProfile,
)
from stoneway_mcp.reconciliation import (
    apply_reconciliation,
    reconcile_markdown_and_json,
)


class BaseStorageBackend(abc.ABC):
    """Abstract interface for StoneWay memory operations."""

    @abc.abstractmethod
    async def get_profile(self) -> ProfileContext:
        pass

    @abc.abstractmethod
    async def update_profile(
        self,
        base_version: int,
        json_patch: Optional[Dict[str, Any]] = None,
        md_append: Optional[str] = None,
        md_replace: Optional[str] = None,
        agent_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        pass

    @abc.abstractmethod
    async def append_note(self, note: str, agent_name: Optional[str] = None) -> Dict[str, Any]:
        pass

    @abc.abstractmethod
    async def get_bio(
        self,
        platform: str = "generic",
        tone: str = "technical",
        max_length: int = 280,
    ) -> Dict[str, Any]:
        pass

    @abc.abstractmethod
    async def trigger_sync(self, integration: str = "all") -> Dict[str, Any]:
        pass


class RemoteApiStorage(BaseStorageBackend):
    """Interacts with the cloud-hosted StoneWay REST API."""

    def __init__(self, client: Optional[StoneWayClient] = None):
        self.client = client or StoneWayClient()

    async def get_profile(self) -> ProfileContext:
        return await self.client.get_profile()

    async def update_profile(
        self,
        base_version: int,
        json_patch: Optional[Dict[str, Any]] = None,
        md_append: Optional[str] = None,
        md_replace: Optional[str] = None,
        agent_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await self.client.update_profile(
            base_version=base_version,
            json_patch=json_patch,
            md_append=md_append,
            md_replace=md_replace,
            agent_name=agent_name,
        )

    async def append_note(self, note: str, agent_name: Optional[str] = None) -> Dict[str, Any]:
        return await self.client.append_note(note=note, agent_name=agent_name)

    async def get_bio(
        self,
        platform: str = "generic",
        tone: str = "technical",
        max_length: int = 280,
    ) -> Dict[str, Any]:
        return await self.client.get_bio(platform=platform, tone=tone, max_length=max_length)

    async def trigger_sync(self, integration: str = "all") -> Dict[str, Any]:
        return await self.client.trigger_sync(integration=integration)


class LocalFileStorage(BaseStorageBackend):
    """Operates directly on local StoneWay.json and StoneWay.md files."""

    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = (base_dir or settings.local_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.json_path = self.base_dir / "StoneWay.json"
        self.md_path = self.base_dir / "StoneWay.md"
        self._ensure_files()

    def _ensure_files(self) -> None:
        if not self.md_path.exists():
            self.md_path.write_text(STARTER_STONEWAY_MD, encoding="utf-8")
        if not self.json_path.exists():
            default_profile = StoneWayProfile()
            self.json_path.write_text(
                json.dumps(default_profile.model_dump(), indent=2),
                encoding="utf-8",
            )

    def _read_profile(self) -> StoneWayProfile:
        try:
            content = self.json_path.read_text(encoding="utf-8")
            data = json.loads(content)
            return StoneWayProfile.model_validate(data)
        except Exception:
            return StoneWayProfile()

    def _read_md(self) -> str:
        try:
            return self.md_path.read_text(encoding="utf-8")
        except Exception:
            return STARTER_STONEWAY_MD

    def _write_profile(self, profile: StoneWayProfile) -> None:
        self.json_path.write_text(
            json.dumps(profile.model_dump(), indent=2),
            encoding="utf-8",
        )

    def _write_md(self, content: str) -> None:
        self.md_path.write_text(content, encoding="utf-8")

    async def get_profile(self) -> ProfileContext:
        profile = self._read_profile()
        md_text = self._read_md()
        needs_rec, excerpt = reconcile_markdown_and_json(profile, md_text)
        return ProfileContext(
            version=profile.meta.version,
            stoneway_json=profile.model_dump(),
            stoneway_md=md_text,
            needs_reconcile=needs_rec,
            unreconciled_md_excerpt=excerpt,
        )

    async def update_profile(
        self,
        base_version: int,
        json_patch: Optional[Dict[str, Any]] = None,
        md_append: Optional[str] = None,
        md_replace: Optional[str] = None,
        agent_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        profile = self._read_profile()
        md_text = self._read_md()

        updated_profile, new_md, unstructured_saved = apply_reconciliation(
            current_profile=profile,
            current_md=md_text,
            base_version=base_version,
            json_patch=json_patch,
            md_append=md_append,
            md_replace=md_replace,
            agent_name=agent_name,
        )

        self._write_profile(updated_profile)
        self._write_md(new_md)

        return {
            "success": True,
            "version": updated_profile.meta.version,
            "unstructured_count": unstructured_saved,
            "message": "Local profile updated and reconciled successfully.",
        }

    async def append_note(self, note: str, agent_name: Optional[str] = None) -> Dict[str, Any]:
        profile = self._read_profile()
        return await self.update_profile(
            base_version=profile.meta.version,
            md_append=note,
            agent_name=agent_name,
        )

    async def get_bio(
        self,
        platform: str = "generic",
        tone: str = "technical",
        max_length: int = 280,
    ) -> Dict[str, Any]:
        profile = self._read_profile()
        return generate_platform_bio(
            profile=profile,
            platform=platform,  # type: ignore
            tone=tone,  # type: ignore
            max_length=max_length,
        )

    async def trigger_sync(self, integration: str = "all") -> Dict[str, Any]:
        return {
            "connector_id": integration,
            "success": True,
            "message": f"Local sync completed for integration '{integration}'.",
            "timestamp": "now",
        }


def get_storage_backend() -> BaseStorageBackend:
    """Factory selecting RemoteApiStorage if token is configured, otherwise LocalFileStorage."""
    if settings.storage_mode == "remote":
        if not settings.token:
            # If user explicitly wants remote but forgot token, raise error
            raise ValueError(
                "STONEWAY_TOKEN is required for remote mode. "
                "Get your token at /app/key or set STONEWAY_STORAGE_MODE=local."
            )
        return RemoteApiStorage()
    return LocalFileStorage()
