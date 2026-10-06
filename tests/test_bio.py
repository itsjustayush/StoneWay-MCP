"""Tests for StoneWay bio generation and privacy filtering."""

from stoneway_mcp.bio_generator import generate_platform_bio
from stoneway_mcp.models import (
    ActiveProject,
    Contact,
    ContactField,
    Identity,
    StoneWayProfile,
    TechnicalProfile,
)


def test_bio_privacy_filtering_and_synthesis():
    profile = StoneWayProfile(
        identity=Identity(name="Ayush", headline="Autonomous Agent Architect"),
        contact=Contact(
            email=ContactField(value="secret_personal@email.com", visibility="private"),
            github=ContactField(value="https://github.com/itsjustayush", visibility="public"),
            twitter=ContactField(value="https://x.com/itsjustayush", visibility="public"),
        ),
        technical_profile=TechnicalProfile(
            primary_languages=["TypeScript", "Python", "Rust", "Go"],
        ),
        active_projects=[
            ActiveProject(name="StoneWay", description="MCP memory protocol"),
            ActiveProject(name="AgentFlow", description="Agent runner"),
        ],
    )

    res = generate_platform_bio(profile, platform="x", tone="technical", max_length=160)

    bio = res["bio"]
    assert "Ayush" in bio
    assert "StoneWay" in bio
    assert len(bio) <= 160

    # Privacy invariant: Private email must NEVER be in sources_used or bio
    assert "secret_personal@email.com" not in bio
    sources = res["sources_used"]
    assert "secret_personal@email.com" not in str(sources["public_contacts"])
    assert "email" not in sources["public_contacts"]
    assert "github" in sources["public_contacts"]


def test_bio_max_length_enforcement():
    profile = StoneWayProfile(
        identity=Identity(
            name="Super Developer With A Very Long Name And Title That Would Normally Overflow",
            headline="Full Stack Engineer Extraordinaire Who Builds Complex Distributed Microservices",
        )
    )

    res = generate_platform_bio(profile, platform="x", max_length=50)
    assert len(res["bio"]) <= 50
    assert res["bio"].endswith("...")
