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
mcp = server  # Canonical alias for @mcp.tool, @mcp.resource, @mcp.prompt

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
async def get_profile_context(query: Optional[str] = None) -> str:
    """Retrieves structured developer profile (StoneWay.json) and markdown scratchpad (StoneWay.md), including active projects, tech stack, preferences, and reconciliation status.

    Use this tool when:
    - The user or prompt asks about the developer's tech stack, current projects, preferences, or background.
    - At the beginning of a coding session to align with the builder's preferences and active libraries.
    - You need to check if there are unreconciled markdown logs that need to be merged into structured data.

    Do NOT use this tool when:
    - You only need a short platform-tailored bio (use get_bio instead).
    - You want to record a quick note or progress entry (use append_note instead).
    - The user query is completely unrelated to the developer or their projects.
    """
    try:
        storage = get_active_storage()
        ctx = await storage.get_profile(query=query)

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
    """Safely updates structured profile attributes and/or appends notes to StoneWay.md without data loss. Reconciles structural updates into StoneWay.json with optimistic locking.

    Use this tool when:
    - You want to update active projects, add newly adopted tech stacks, or modify developer preferences.
    - You are reconciling unstructured scratchpad excerpts into structured StoneWay.json fields.
    - You have a verified base_version obtained from get_profile_context.

    Do NOT use this tool when:
    - You only want to append a timestamped progress note without modifying structured metadata (use append_note instead).
    - You do not know the current base_version (always call get_profile_context first to avoid 409 conflict).
    - You want to overwrite data without respecting existing fields (StoneWay enforces zero-data-loss).
    """
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
    """Quickly appends an append-only timestamped note, thought, or build log into StoneWay.md tagged with your agent name.

    Use this tool when:
    - Finishing a coding task or session to log what was completed or changed.
    - Capturing quick architectural thoughts, blockers, or ideas during development.
    - Leaving handover notes for other AI agents or the developer.

    Do NOT use this tool when:
    - You need to update structured profile fields like primary_languages or active_projects (use update_profile_context instead).
    - You want to read or query existing notes (use get_profile_context or stoneway://markdown instead).
    """
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
    """Generates platform-tailored builder bios using STRICTLY fields marked with visibility: 'public'. Filters out private contact and location info.

    Use this tool when:
    - The user asks: "Write my bio", "Draft my X profile", or "Update my GitHub bio".
    - You need a concise, privacy-safe intro summary of the developer tailored to character limits and tone.

    Do NOT use this tool when:
    - You need comprehensive tech stack facts or internal project details (use get_profile_context instead).
    - The user wants to edit or mutate profile data (use update_profile_context instead).
    """
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
    """Triggers on-demand synchronization for connected integrations (GitHub, npm, Hugging Face, RSS, Notion).

    Use this tool when:
    - The developer asks to refresh or sync their GitHub repos or external profiles into StoneWay.
    - Recent external project activity needs to be imported into active projects.

    Do NOT use this tool when:
    - Making local agent note updates (use append_note instead).
    - Reading existing synced data (use get_profile_context instead).
    """
    try:
        storage = get_active_storage()
        res = await storage.trigger_sync(integration=integration)
        return wrap_in_safety_envelope(json.dumps(res, indent=2))
    except Exception as e:
        return f"[StoneWay Sync Error]: {str(e)}"


# =====================================================================
# TOOL 6: export_json_resume
# =====================================================================
@server.tool()
async def export_json_resume() -> str:
    """Generates and exports the developer's StoneWay profile formatted according to the standard JSON Resume schema.

    Use this tool when:
    - The user asks for their resume, CV, or JSON Resume export.
    - An external tool or agent requires standard JSON Resume format.

    Do NOT use this tool when:
    - You need raw StoneWay.json or scratchpad logs (use get_profile_context instead).
    """
    try:
        storage = get_active_storage()
        ctx = await storage.get_profile()
        profile_json = ctx.stoneway_json
        identity = profile_json.get("identity", {})
        contact = profile_json.get("contact", {})
        tech = profile_json.get("technical_profile", {})

        profiles_list = []
        for net, key in [("GitHub", "github"), ("Twitter/X", "twitter"), ("LinkedIn", "linkedin")]:
            field = contact.get(key)
            if isinstance(field, dict) and field.get("visibility") == "public" and field.get("value"):
                profiles_list.append({"network": net, "username": field["value"], "url": field["value"]})

        skills = []
        if tech.get("primary_languages"):
            skills.append({"name": "Programming Languages", "keywords": tech["primary_languages"]})
        if tech.get("frameworks"):
            skills.append({"name": "Frameworks", "keywords": tech["frameworks"]})
        if tech.get("databases"):
            skills.append({"name": "Databases", "keywords": tech["databases"]})
        if tech.get("tools"):
            skills.append({"name": "Tools", "keywords": tech["tools"]})

        projects = [
            {
                "name": p.get("name", "Project"),
                "description": p.get("description", ""),
                "url": p.get("live_url") or p.get("repo_url"),
                "keywords": p.get("tech_stack", []),
            }
            for p in profile_json.get("active_projects", [])
        ]

        resume = {
            "basics": {
                "name": identity.get("name") or "Developer",
                "label": identity.get("headline") or "Software Builder",
                "image": identity.get("avatar", ""),
                "summary": identity.get("bio", ""),
                "profiles": profiles_list,
            },
            "skills": skills,
            "projects": projects,
            "meta": {
                "canonical": "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
                "version": f"v{ctx.version}",
            },
        }
        return json.dumps(resume, indent=2)
    except Exception as e:
        return f"[StoneWay Error]: Unable to export JSON Resume: {str(e)}"


# =====================================================================
# TOOL 7: list_context_files
# =====================================================================
@server.tool()
async def list_context_files(
    group: Optional[str] = None,
    tag: Optional[str] = None,
) -> str:
    """Lists metadata for user-owned context documents (PDFs, research notes, architecture specs, resumes).

    Use this tool when:
    - Discovering what supplementary context files or documents the user has uploaded.
    - Looking for specific project notes, career documents, or research whitepapers.

    Do NOT use this tool when:
    - You need the user's primary identity or stack (use get_profile_context instead).
    """
    try:
        storage = get_active_storage()
        res = await storage.list_context_files(group=group, tag=tag)
        return wrap_in_safety_envelope(json.dumps(res, indent=2))
    except Exception as e:
        return f"[StoneWay Error]: Unable to list context files: {str(e)}"


# =====================================================================
# TOOL 8: get_context_file
# =====================================================================
@server.tool()
async def get_context_file(file_id: str) -> str:
    """Fetches the verified extracted text content of a specific user-owned context file by its secure opaque ID (e.g. 'file_01j...').

    Use this tool when:
    - The user references a specific document or after discovering its ID via list_context_files or search_context.

    Do NOT use this tool when:
    - You want to search across all files (use search_context instead).
    - Guessing filenames (files must be addressed by their secure ID).
    """
    try:
        storage = get_active_storage()
        res = await storage.get_context_file(file_id=file_id)
        if isinstance(res, dict) and "safe_content" in res:
            return res["safe_content"]
        return wrap_in_safety_envelope(json.dumps(res, indent=2))
    except Exception as e:
        return f"[StoneWay Error]: Unable to fetch context file: {str(e)}"


# =====================================================================
# TOOL 9: search_context
# =====================================================================
@server.tool()
async def search_context(query: str, group: Optional[str] = None) -> str:
    """Searches extracted passages across the user's uploaded context files and StoneWay.md scratchpad.

    Use this tool when:
    - Looking for specific technical details, project architecture notes, or research papers without downloading entire documents.

    Do NOT use this tool when:
    - Querying standard profile fields like languages or bio (use get_profile_context instead).
    """
    try:
        storage = get_active_storage()
        res = await storage.search_context(query=query, group=group)
        return wrap_in_safety_envelope(json.dumps(res, indent=2))
    except Exception as e:
        return f"[StoneWay Error]: Search context failed: {str(e)}"


# =====================================================================
# TOOL 10: list_prompts
# =====================================================================
@server.tool()
async def list_prompts() -> str:
    """Lists user-authored custom prompts and workflows from PROMPTS.json.

    Use this tool when:
    - Discovering what specialized workflows or prompts the user has created.
    """
    try:
        storage = get_active_storage()
        res = await storage.list_prompts()
        prompts = res.get("prompts", []) if isinstance(res, dict) else []
        return wrap_in_safety_envelope(json.dumps(prompts, indent=2))
    except Exception as e:
        return f"[StoneWay Error]: Unable to list prompts: {str(e)}"


# =====================================================================
# TOOL 11: run_prompt
# =====================================================================
@server.tool()
async def run_prompt(name: str, arguments: Optional[Dict[str, Any]] = None) -> str:
    """Renders a user-authored prompt by name, substituting arguments and canonical profile context variables.

    Use this tool when:
    - Executing a user prompt found via list_prompts.
    """
    try:
        storage = get_active_storage()
        res = await storage.run_prompt(name=name, arguments=arguments)
        if isinstance(res, dict) and "rendered_content" in res:
            return res["rendered_content"]
        return str(res)
    except Exception as e:
        return f"[StoneWay Error]: Unable to run prompt '{name}': {str(e)}"


# =====================================================================
# TOOL 12: list_skills
# =====================================================================
@server.tool()
async def list_skills() -> str:
    """Lists specialized user skill guidelines (e.g. UI design tokens, coding standards) defined in PROMPTS.json.

    Use this tool when:
    - Discovering domain-specific conventions or design standards the user has defined.
    """
    try:
        storage = get_active_storage()
        res = await storage.list_prompts()
        skills = res.get("skills", []) if isinstance(res, dict) else []
        return wrap_in_safety_envelope(json.dumps(skills, indent=2))
    except Exception as e:
        return f"[StoneWay Error]: Unable to list skills: {str(e)}"


# =====================================================================
# TOOL 13: get_skill
# =====================================================================
@server.tool()
async def get_skill(name: str) -> str:
    """Retrieves the complete instructions and guidelines for a specific skill by name.

    Use this tool when:
    - The user asks you to perform a task governed by a skill convention (e.g., UI building, testing standards).
    """
    try:
        storage = get_active_storage()
        res = await storage.run_prompt(name=name, arguments={})
        if isinstance(res, dict) and "rendered_content" in res:
            return res["rendered_content"]
        return str(res)
    except Exception as e:
        return f"[StoneWay Error]: Unable to fetch skill '{name}': {str(e)}"


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
