"""Tests for StoneWay reconciliation logic, optimistic locking, and zero-data-loss invariant."""

import pytest
from stoneway_mcp.models import StoneWayProfile
from stoneway_mcp.reconciliation import (
    VersionConflictError,
    apply_reconciliation,
    reconcile_markdown_and_json,
)


def test_reconciliation_optimistic_locking_success():
    profile = StoneWayProfile()
    assert profile.meta.version == 1

    updated, new_md, overflow_count = apply_reconciliation(
        current_profile=profile,
        current_md="# Scratchpad",
        base_version=1,
        json_patch={"identity": {"name": "Ayush", "headline": "Vibecoder"}},
        md_append="Created new MCP server.",
        agent_name="cursor",
    )

    assert updated.meta.version == 2
    assert updated.identity.name == "Ayush"
    assert updated.identity.headline == "Vibecoder"
    assert "Created new MCP server." in new_md
    assert "<!-- Log" in new_md
    assert "[cursor]" in new_md
    assert overflow_count == 0


def test_reconciliation_version_conflict_rejection():
    profile = StoneWayProfile()
    profile.meta.version = 3

    # Agent attempts update with stale base_version=2
    with pytest.raises(VersionConflictError) as exc_info:
        apply_reconciliation(
            current_profile=profile,
            current_md="# Scratchpad",
            base_version=2,
            json_patch={"identity": {"name": "Hacker"}},
        )

    assert "Version conflict" in str(exc_info.value)
    assert "Base version 2 does not match current version 3" in str(exc_info.value)


def test_zero_data_loss_unstructured_overflow():
    profile = StoneWayProfile()

    # Pass an unrecognized custom key from an experimental AI agent
    patch = {
        "identity": {"name": "Ayush"},
        "experimental_vibecoding_index": {"score": 99.8, "mode": "hyperdrive"},
        "agent_thought_trail": ["step 1", "step 2"],
    }

    updated, _, overflow_count = apply_reconciliation(
        current_profile=profile,
        current_md="# Scratchpad",
        base_version=1,
        json_patch=patch,
        agent_name="agent-42",
    )

    assert overflow_count == 2
    assert len(updated.unstructured_metadata) == 2

    # Check preserved contents
    first_overflow = updated.unstructured_metadata[0]
    assert first_overflow.content == {"experimental_vibecoding_index": {"score": 99.8, "mode": "hyperdrive"}}
    assert first_overflow.source_agent == "agent-42"
    assert first_overflow.tag == "unstructured_overflow"


def test_reconcile_markdown_detection():
    profile = StoneWayProfile()
    profile.meta.version = 2
    profile.meta.last_reconciled_md_version = 1

    md_content = "# Title\n" + "\n".join([f"- note line {i}" for i in range(30)])

    needs_rec, excerpt = reconcile_markdown_and_json(profile, md_content)
    assert needs_rec is True
    assert excerpt is not None
    assert "note line 29" in excerpt
