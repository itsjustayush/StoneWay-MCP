"""Integration tests for StoneWay Python MCPServer tools, resources, and prompts."""

import json
import tempfile
from pathlib import Path
import pytest
from stoneway_mcp.envelope import validate_safety_boundary
from stoneway_mcp.server import server, set_active_storage
from stoneway_mcp.storage import LocalFileStorage


@pytest.fixture(autouse=True)
def setup_local_storage():
    """Points server storage to a fresh temporary directory for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = LocalFileStorage(base_dir=Path(tmpdir))
        set_active_storage(storage)
        yield storage


@pytest.mark.asyncio
async def test_mcp_tools_list():
    tools = await server.list_tools()
    tool_names = [t.name for t in tools]
    assert "get_profile_context" in tool_names
    assert "update_profile_context" in tool_names
    assert "append_note" in tool_names
    assert "get_bio" in tool_names
    assert "trigger_external_sync" in tool_names


@pytest.mark.asyncio
async def test_get_profile_context_tool():
    res = await server.call_tool("get_profile_context", {})
    assert not res.is_error
    text_content = res.content[0].text
    assert validate_safety_boundary(text_content)
    assert "primary_source_stoneway_json" in text_content
    assert "raw_markdown_stoneway_md" in text_content


@pytest.mark.asyncio
async def test_update_profile_context_tool():
    # Update profile with new name
    update_res = await server.call_tool(
        "update_profile_context",
        {
            "base_version": 1,
            "json_patch": {"identity": {"name": "Test Builder"}},
            "agent_name": "pytest-runner",
        },
    )
    assert not update_res.is_error
    text_content = update_res.content[0].text
    assert "success" in text_content

    # Now verify updated context
    get_res = await server.call_tool("get_profile_context", {})
    context_text = get_res.content[0].text
    assert "Test Builder" in context_text


@pytest.mark.asyncio
async def test_append_note_tool():
    note_res = await server.call_tool(
        "append_note",
        {"note": "Added unit tests for Python MCP server.", "agent_name": "test-agent"},
    )
    assert not note_res.is_error
    assert "Note appended successfully" in note_res.content[0].text

    # Read markdown resource to confirm note is saved
    md_content = await server.read_resource("stoneway://markdown")
    assert "Added unit tests for Python MCP server." in md_content[0].text


@pytest.mark.asyncio
async def test_get_bio_tool():
    bio_res = await server.call_tool(
        "get_bio",
        {"platform": "github", "tone": "minimal", "max_length": 160},
    )
    assert not bio_res.is_error
    text = bio_res.content[0].text
    assert validate_safety_boundary(text)
    assert "sources_used" in text


@pytest.mark.asyncio
async def test_trigger_external_sync_tool():
    sync_res = await server.call_tool(
        "trigger_external_sync",
        {"integration": "github"},
    )
    assert not sync_res.is_error
    text = sync_res.content[0].text
    assert "github" in text
