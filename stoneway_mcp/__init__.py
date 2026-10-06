"""StoneWay MCP Server & Memory Synchronization Engine.

A Model Context Protocol (MCP) server for modern AI developers & vibecoders,
providing safe context retrieval, optimistic profile updates, note appending,
and privacy-hardened bio generation across AI agent sessions.
"""

__version__ = "0.1.0"
__author__ = "StoneWay Authors"
__license__ = "MIT"

from stoneway_mcp.envelope import wrap_in_safety_envelope, unwrap_safety_envelope
from stoneway_mcp.models import StoneWayProfile, StoneWayIdentity, StoneWayProject
from stoneway_mcp.reconciliation import reconcile_markdown_and_json
from stoneway_mcp.bio_generator import generate_platform_bio

__all__ = [
    "__version__",
    "wrap_in_safety_envelope",
    "unwrap_safety_envelope",
    "StoneWayProfile",
    "StoneWayIdentity",
    "StoneWayProject",
    "reconcile_markdown_and_json",
    "generate_platform_bio",
]
