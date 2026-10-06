"""Reconciliation engine for StoneWay profile memories.

Implements optimistic locking version verification, markdown log parsing,
JSON patch merging, and the Zero-Data-Loss invariant (preserving unknown keys
into unstructured_metadata).
"""

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from stoneway_mcp.models import (
    StoneWayProfile,
    UnstructuredMetadata,
)

KNOWN_PROFILE_KEYS = {
    "identity",
    "contact",
    "technical_profile",
    "active_projects",
    "past_projects",
    "planned_ideas",
    "frequent_prompts",
    "preferences",
    "bio_variants",
}


class VersionConflictError(Exception):
    """Raised when base_version does not match current profile version."""
    pass


def extract_unreconciled_excerpt(md_content: str, line_limit: int = 25) -> Optional[str]:
    """Extracts trailing lines of StoneWay.md to assist agents in identifying new notes."""
    if not md_content.strip():
        return None
    lines = md_content.splitlines()
    if len(lines) <= line_limit:
        return md_content
    return "\n".join(lines[-line_limit:])


def apply_reconciliation(
    current_profile: StoneWayProfile,
    current_md: str,
    base_version: int,
    json_patch: Optional[Dict[str, Any]] = None,
    md_append: Optional[str] = None,
    md_replace: Optional[str] = None,
    agent_name: Optional[str] = None,
) -> Tuple[StoneWayProfile, str, int]:
    """Applies atomic updates with optimistic locking and zero data loss.

    Returns:
        (updated_profile, updated_markdown, unstructured_saved_count)
    Raises:
        VersionConflictError if base_version != current_profile.meta.version
    """
    current_version = current_profile.meta.version
    if base_version != current_version:
        raise VersionConflictError(
            f"Version conflict: Base version {base_version} does not match current version {current_version}. "
            "Please call get_profile_context to fetch the latest context and retry."
        )

    updated_profile_dict = current_profile.model_dump()
    new_md = current_md
    unstructured_saved_count = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    agent_label = agent_name or "mcp-agent"

    # 1. Handle Markdown Updates
    if md_replace is not None:
        new_md = md_replace
    elif md_append:
        clean_append = md_append.strip()
        header = f"<!-- Log {now_iso} [{agent_label}] -->"
        new_md = f"{new_md.rstrip()}\n\n{header}\n{clean_append}\n"

    # 2. Handle JSON Patch with Zero-Data-Loss Invariant
    if json_patch:
        for key, value in json_patch.items():
            if key in KNOWN_PROFILE_KEYS:
                if isinstance(value, dict) and isinstance(updated_profile_dict.get(key), dict):
                    updated_profile_dict[key].update(value)
                else:
                    updated_profile_dict[key] = value
            else:
                # Unknown / experimental key -> Capture in unstructured_metadata
                overflow_item = UnstructuredMetadata(
                    content={key: value},
                    source_agent=agent_label,
                    timestamp=now_iso,
                    tag="unstructured_overflow",
                )
                updated_profile_dict["unstructured_metadata"].append(overflow_item.model_dump())
                unstructured_saved_count += 1

    # 3. Advance Version and Metadata
    next_version = current_version + 1
    updated_profile_dict["meta"]["version"] = next_version
    updated_profile_dict["meta"]["last_reconciled_md_version"] = next_version
    updated_profile_dict["meta"]["updated_at"] = now_iso

    # Validate resulting structure into StoneWayProfile
    updated_profile = StoneWayProfile.model_validate(updated_profile_dict)

    return updated_profile, new_md, unstructured_saved_count


def reconcile_markdown_and_json(
    profile: StoneWayProfile,
    md_content: str,
) -> Tuple[bool, Optional[str]]:
    """Determines if StoneWay.md contains updates ahead of the structured JSON context."""
    version = profile.meta.version
    last_reconciled = profile.meta.last_reconciled_md_version
    needs_reconcile = version > last_reconciled

    excerpt = None
    if needs_reconcile:
        excerpt = extract_unreconciled_excerpt(md_content)

    return needs_reconcile, excerpt
