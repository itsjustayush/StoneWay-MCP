"""StoneWay Model Context Protocol (MCP) Server in Python.

Exposes tools, resources, and prompts for AI coding agents to access, update,
and synchronize developer profiles, active project contexts, scratchpad notes,
and privacy-hardened bios.
"""

import argparse
import json
import sys
from typing import Any, Dict, Optional

try:
    from mcp.server.mcpserver import MCPServer
except ImportError:
    try:
        from mcp.server.fastmcp import FastMCP as MCPServer  # type: ignore
    except ImportError:
        from mcp.server import Server as MCPServer  # type: ignore

from stoneway_mcp.config import settings
from stoneway_mcp.envelope import wrap_in_safety_envelope
from stoneway_mcp.models import (
    BioPlatform,
    BioTone,
)
from stoneway_mcp.reconciliation import VersionConflictError
from stoneway_mcp.storage import (
    BaseStorageBackend,
    LocalFileStorage,
    RemoteApiStorage,
    get_storage_backend,
)

# Instantiate the MCP Server
server = MCPServer(
    name="stoneway-mcp",
    version="0.1.0",
)

# Active storage engine (lazily resolved)
_storage: Optional[BaseStorageBackend] = None


def get_active_storage() -> BaseStorageBackend:
    global _storage
    if _storage is None:
        _storage = get_storage_backend()
    return _storage


def set_active_storage(storage: BaseStorageBackend) -> None:
    global _storage
    _storage = storage


# =====================================================================
# TOOL 1: get_profile_context
# =====================================================================
@server.tool()
async def get_profile_context() -> str:
    """Call this first whenever you need facts, tech stacks, bio info, links, or active projects about the user. Returns structured StoneWay.json and raw StoneWay.md with reconciliation guidance."""
    try:
        storage = get_active_storage()
        ctx = await storage.get_profile()

        instruction = (
            "NOTICE: StoneWay.md contains newer unstructured logs. Please parse the unreconciled_md_excerpt, "
            "extract any meaningful skills, links, or projects, and call update_profile_context with a json_patch to merge them safely."
            if ctx.needs_reconcile
            else "Context is synchronized."
        )

        payload = {
            "version": ctx.version,
            "needs_reconcile": ctx.needs_reconcile,
            "unreconciled_md_excerpt": ctx.unreconciled_md_excerpt if ctx.needs_reconcile else None,
            "reconciliation_instruction": instruction,
            "primary_source_stoneway_json": ctx.stoneway_json,
            "raw_markdown_stoneway_md": ctx.stoneway_md,
        }

        return wrap_in_safety_envelope(json.dumps(payload, indent=2))
    except Exception as e:
        return f"[StoneWay Error]: Unable to retrieve profile context: {str(e)}"


# =====================================================================
# TOOL 2: update_profile_context
# =====================================================================
@server.tool()
async def update_profile_context(
    base_version: int,
    json_patch: Optional[Dict[str, Any]] = None,
    md_append: Optional[str] = None,
    agent_name: Optional[str] = None,
) -> str:
    """Safely updates structured profile attributes and/or appends notes to StoneWay.md without data loss. Reconciles structural updates into StoneWay.json with optimistic locking."""
    try:
        storage = get_active_storage()
        res = await storage.update_profile(
            base_version=base_version,
            json_patch=json_patch,
            md_append=md_append,
            agent_name=agent_name,
        )

        return wrap_in_safety_envelope(json.dumps(res, indent=2))
    except VersionConflictError as e:
        return f"[StoneWay Conflict (409)]: {str(e)}"
    except Exception as e:
        return f"[StoneWay Update Error]: {str(e)}. If conflict (409), call get_profile_context to fetch latest version and retry."


# =====================================================================
# TOOL 3: append_note
# =====================================================================
@server.tool()
async def append_note(
    note: str,
    agent_name: Optional[str] = None,
) -> str:
    """Quickly appends a timestamped scratchpad note, idea, or observation into StoneWay.md tagged with your agent name."""
    try:
        storage = get_active_storage()
        res = await storage.append_note(note=note, agent_name=agent_name)
        return f"[StoneWay]: Note appended successfully. {json.dumps(res)}"
    except Exception as e:
        return f"[StoneWay Error]: Failed to append note: {str(e)}"


# =====================================================================
# TOOL 4: get_bio
# =====================================================================
@server.tool()
async def get_bio(
    platform: str = "generic",
    tone: str = "technical",
    max_length: int = 280,
) -> str:
    """Generates platform-tailored builder bios using STRICTLY fields marked with visibility: 'public'. Filters out private contact and location info."""
    try:
        storage = get_active_storage()
        res = await storage.get_bio(
            platform=platform,
            tone=tone,
            max_length=max_length,
        )
        return wrap_in_safety_envelope(json.dumps(res, indent=2))
    except Exception as e:
        return f"[StoneWay Error]: Unable to generate bio: {str(e)}"


# =====================================================================
# TOOL 5: trigger_external_sync
# =====================================================================
@server.tool()
async def trigger_external_sync(
    integration: str = "all",
) -> str:
    """Triggers on-demand synchronization for connected integrations (GitHub, npm, Hugging Face, RSS, Notion)."""
    try:
        storage = get_active_storage()
        res = await storage.trigger_sync(integration=integration)
        return wrap_in_safety_envelope(json.dumps(res, indent=2))
    except Exception as e:
        return f"[StoneWay Sync Error]: {str(e)}"


# =====================================================================
# RESOURCE 1: stoneway://profile
# =====================================================================
@server.resource("stoneway://profile")
async def get_profile_resource() -> str:
    """Raw JSON format of the current StoneWay profile."""
    storage = get_active_storage()
    ctx = await storage.get_profile()
    return json.dumps(ctx.stoneway_json, indent=2)


# =====================================================================
# RESOURCE 2: stoneway://markdown
# =====================================================================
@server.resource("stoneway://markdown")
async def get_markdown_resource() -> str:
    """Raw Markdown format of the StoneWay.md scratchpad."""
    storage = get_active_storage()
    ctx = await storage.get_profile()
    return ctx.stoneway_md


# =====================================================================
# PROMPT 1: write_my_bio
# =====================================================================
@server.prompt("write_my_bio")
async def write_my_bio_prompt(
    platform: str = "generic",
    goal: str = "Accurately represent my current stack, vibe, and projects without fluff.",
) -> str:
    """Draft a polished, compelling developer bio based strictly on public StoneWay builder context."""
    storage = get_active_storage()
    try:
        bio_data = await storage.get_bio(platform=platform)
    except Exception:
        bio_data = {"error": "No public profile data available."}

    return (
        f"Please draft a polished, compelling developer bio for {platform} "
        f"based strictly on my public StoneWay builder context:\n"
        f"{wrap_in_safety_envelope(json.dumps(bio_data, indent=2))}\n\n"
        f"Additional Goal: {goal}"
    )


# =====================================================================
# PROMPT 2: reconcile_scratchpad
# =====================================================================
@server.prompt("reconcile_scratchpad")
async def reconcile_scratchpad_prompt() -> str:
    """Prompt the agent to reconcile raw StoneWay.md scratchpad additions into structured StoneWay.json."""
    storage = get_active_storage()
    ctx = await storage.get_profile()
    return (
        "Please review the unmerged scratchpad logs and extract any new skills, active projects, "
        "or contact links. Then formulate a call to `update_profile_context` with a clean `json_patch`.\n\n"
        f"Base Version: {ctx.version}\n"
        f"Scratchpad Excerpt:\n{ctx.unreconciled_md_excerpt or 'No unreconciled logs.'}"
    )


def main() -> None:
    """CLI launcher for StoneWay MCP Server."""
    parser = argparse.ArgumentParser(
        description="StoneWay MCP Server: Developer Memory & Profile Sync Protocol"
    )
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse", "streamable-http"],
        default="stdio",
        help="MCP Transport layer (default: stdio)",
    )
    parser.add_argument(
        "--mode",
        choices=["auto", "remote", "local"],
        default=None,
        help="Storage mode: 'remote' (Next.js/Neon cloud API), 'local' (StoneWay.json/.md files), or 'auto'",
    )
    parser.add_argument(
        "--local-dir",
        default=None,
        help="Directory path for local StoneWay.json and StoneWay.md storage",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port for SSE or HTTP transport",
    )
    args = parser.parse_args()

    # Configure custom storage mode or directory if provided via CLI
    if args.mode:
        import os
        os.environ["STONEWAY_STORAGE_MODE"] = args.mode
    if args.local_dir:
        import os
        os.environ["STONEWAY_LOCAL_DIR"] = args.local_dir

    # Print startup diagnostic banner to stderr (so stdio transport on stdout remains clean!)
    print(
        f"[StoneWay MCP Server] Initializing in '{settings.storage_mode}' mode (transport: {args.transport})...",
        file=sys.stderr,
    )
    if settings.storage_mode == "remote":
        print(
            f"[StoneWay MCP Server] Connected to cloud backend at: {settings.api_url}",
            file=sys.stderr,
        )
    else:
        print(
            f"[StoneWay MCP Server] Using local storage directory: {settings.local_dir}",
            file=sys.stderr,
        )

    # Run the server
    if args.transport == "stdio":
        server.run(transport="stdio")
    elif args.transport == "sse":
        server.run(transport="sse", port=args.port)
    elif args.transport == "streamable-http":
        server.run(transport="streamable-http", port=args.port)
    else:
        server.run()


if __name__ == "__main__":
    main()
