"""Asynchronous HTTP Client for StoneWay REST API."""

from typing import Any, Dict, Optional
import httpx
from stoneway_mcp.config import settings
from stoneway_mcp.models import ProfileContext


class StoneWayApiError(Exception):
    """Raised when the StoneWay API returns an error response."""

    def __init__(self, message: str, status_code: int = 500, data: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.data = data or {}


class StoneWayClient:
    """Asynchronous client interacting with the StoneWay cloud backend."""

    def __init__(
        self,
        api_url: Optional[str] = None,
        token: Optional[str] = None,
        agent_name: Optional[str] = None,
        timeout: float = 15.0,
    ):
        self.api_url = (api_url or settings.api_url).rstrip("/")
        self.token = token or settings.token
        self.agent_name = agent_name or settings.agent_name
        self.timeout = timeout

    def _headers(self, override_agent: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "X-StoneWay-Agent": override_agent or self.agent_name,
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def get_profile(self) -> ProfileContext:
        """Fetches the active StoneWay profile, structured JSON, and markdown scratchpad."""
        url = f"{self.api_url}/profile"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                res = await client.get(url, headers=self._headers())
            except Exception as e:
                raise StoneWayApiError(f"Network error connecting to StoneWay API ({url}): {e}")

        data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        if not res.is_success:
            err_msg = data.get("error") or data.get("message") or f"HTTP {res.status_code}"
            raise StoneWayApiError(f"Failed to fetch profile: {err_msg}", res.status_code, data)

        return ProfileContext.model_validate(data)

    async def update_profile(
        self,
        base_version: int,
        json_patch: Optional[Dict[str, Any]] = None,
        md_append: Optional[str] = None,
        md_replace: Optional[str] = None,
        agent_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Atomically updates structured profile fields and/or appends markdown notes."""
        url = f"{self.api_url}/profile"
        payload = {
            "base_version": base_version,
            "json_patch": json_patch,
            "md_append": md_append,
            "md_replace": md_replace,
            "agent_name": agent_name or self.agent_name,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                res = await client.patch(url, json=payload, headers=self._headers(agent_name))
            except Exception as e:
                raise StoneWayApiError(f"Network error connecting to StoneWay API ({url}): {e}")

        data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        if not res.is_success:
            err_msg = data.get("error") or data.get("message") or f"HTTP {res.status_code}"
            raise StoneWayApiError(f"Update failed: {err_msg}", res.status_code, data)

        return data

    async def append_note(self, note: str, agent_name: Optional[str] = None) -> Dict[str, Any]:
        """Appends a timestamped scratchpad note into StoneWay.md."""
        url = f"{self.api_url}/notes"
        payload = {"note": note, "agent_name": agent_name or self.agent_name}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                res = await client.post(url, json=payload, headers=self._headers(agent_name))
            except Exception as e:
                raise StoneWayApiError(f"Network error connecting to StoneWay API ({url}): {e}")

        data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        if not res.is_success:
            err_msg = data.get("error") or data.get("message") or f"HTTP {res.status_code}"
            raise StoneWayApiError(f"Append note failed: {err_msg}", res.status_code, data)

        return data

    async def get_bio(
        self,
        platform: str = "generic",
        tone: str = "technical",
        max_length: int = 280,
    ) -> Dict[str, Any]:
        """Requests platform-tailored public-only builder bio from API."""
        url = f"{self.api_url}/bio"
        params = {"platform": platform, "tone": tone, "max_length": str(max_length)}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                res = await client.get(url, params=params, headers=self._headers())
            except Exception as e:
                raise StoneWayApiError(f"Network error connecting to StoneWay API ({url}): {e}")

        data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        if not res.is_success:
            err_msg = data.get("error") or data.get("message") or f"HTTP {res.status_code}"
            raise StoneWayApiError(f"Bio generation failed: {err_msg}", res.status_code, data)

        return data

    async def trigger_sync(self, integration: str = "all") -> Dict[str, Any]:
        """Triggers connector synchronizations."""
        url = f"{self.api_url}/sync"
        payload = {"integration": integration}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                res = await client.post(url, json=payload, headers=self._headers())
            except Exception as e:
                raise StoneWayApiError(f"Network error connecting to StoneWay API ({url}): {e}")

        data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        if not res.is_success:
            err_msg = data.get("error") or data.get("message") or f"HTTP {res.status_code}"
            raise StoneWayApiError(f"Connector sync failed: {err_msg}", res.status_code, data)

        return data
