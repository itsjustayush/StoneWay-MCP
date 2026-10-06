"""Bio generation engine for StoneWay.

Synthesizes platform-tailored builder bios using STRICTLY fields marked with
visibility: 'public'. Filters out private contact and personal information.
"""

from typing import Any, Dict, Optional
from stoneway_mcp.models import BioPlatform, BioTone, StoneWayProfile


def generate_platform_bio(
    profile: StoneWayProfile,
    platform: BioPlatform = "generic",
    tone: BioTone = "technical",
    max_length: int = 280,
) -> Dict[str, Any]:
    """Generates a privacy-filtered, platform-tailored developer bio."""
    identity = profile.identity
    name = identity.name or identity.handle or "Developer"
    role = identity.headline or "Full-Stack Builder & Vibecoder"
    languages = ", ".join(profile.technical_profile.primary_languages[:4])
    active_projects = " & ".join([p.name for p in profile.active_projects[:2]])

    # Check if a custom predefined bio variant exists and fits within character budget
    bio_variants_dict = profile.bio_variants.model_dump()
    existing_variant = bio_variants_dict.get(platform)
    if existing_variant and existing_variant.strip() and len(existing_variant) <= max_length:
        chosen_bio = existing_variant.strip()
    else:
        # Synthesize tailored bio based on platform & tone
        if platform in ("x", "github"):
            if tone == "minimal":
                chosen_bio = f"{name} | {role} | {languages}" if languages else f"{name} | {role}"
            elif tone == "founder":
                projects_text = active_projects or "autonomous software"
                stack_text = languages or "TypeScript & Python"
                chosen_bio = f"Building {projects_text}. {role}. Crafting with {stack_text}."
            elif tone == "casual":
                projects_text = active_projects or "cool software"
                chosen_bio = f"Hey, I'm {name}! {role}. Hacking on {projects_text}."
            else:  # technical
                projects_text = active_projects or "AI & Web"
                stack_text = languages or "modern tech"
                chosen_bio = f"Hey, I'm {name}. {role}. Currently hacking on {projects_text} with {stack_text}."

        elif platform == "linkedin":
            stack_text = languages or "full-stack development and distributed systems"
            projects_text = active_projects or "innovative software products"
            chosen_bio = (
                f"{name} — {role}. Specializing in {stack_text}. "
                f"Currently engineering {projects_text}. "
                "Focused on scalable architectures and AI systems."
            )

        elif platform == "devpost":
            stack_text = languages or "TypeScript, Python, Next.js"
            projects_text = active_projects or "hackathon projects"
            chosen_bio = (
                f"{role} passionate about rapid prototyping and autonomous systems. "
                f"Stack: {stack_text}. Building {projects_text}."
            )

        else:  # generic
            stack_text = languages or "TypeScript, Python, and AI"
            chosen_bio = f"{name} — {role}. Building with {stack_text}."

    # Enforce strict max length truncation
    if len(chosen_bio) > max_length:
        chosen_bio = chosen_bio[: max_length - 3].rstrip() + "..."

    # Extract strictly public contacts
    public_contacts: Dict[str, str] = {}
    contact_dict = profile.contact.model_dump()
    for field_name, field_data in contact_dict.items():
        if isinstance(field_data, dict):
            if field_data.get("visibility") == "public" and field_data.get("value"):
                public_contacts[field_name] = field_data["value"]
        elif field_name == "other" and isinstance(field_data, dict):
            for sub_key, sub_val in field_data.items():
                if isinstance(sub_val, dict) and sub_val.get("visibility") == "public" and sub_val.get("value"):
                    public_contacts[sub_key] = sub_val["value"]

    return {
        "platform": platform,
        "tone": tone,
        "bio": chosen_bio,
        "character_count": len(chosen_bio),
        "sources_used": {
            "name": name,
            "headline": role,
            "public_contacts": public_contacts,
            "active_projects_count": len(profile.active_projects),
        },
    }
