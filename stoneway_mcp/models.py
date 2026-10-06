"""Data models and schemas for StoneWay.

Provides full Pydantic v2 schemas for structured profile memories,
optimistic updates, scratchpad notes, bio generation requests, and
connector results.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field

Visibility = Literal["public", "private"]
ProjectStatus = Literal["active", "paused", "in-review", "launching"]
Priority = Literal["low", "medium", "high"]
BioPlatform = Literal["github", "x", "linkedin", "devpost", "generic"]
BioTone = Literal["casual", "technical", "founder", "minimal"]


class ContactField(BaseModel):
    value: str = ""
    visibility: Visibility = "public"


class Identity(BaseModel):
    name: str = ""
    handle: str = ""
    avatar: str = ""
    headline: str = ""
    bio: str = ""
    location: str = ""
    timezone: str = ""


class Contact(BaseModel):
    email: Optional[ContactField] = None
    github: Optional[ContactField] = None
    twitter: Optional[ContactField] = None
    linkedin: Optional[ContactField] = None
    website: Optional[ContactField] = None
    discord: Optional[ContactField] = None
    other: Dict[str, ContactField] = Field(default_factory=dict)


class TechnicalProfile(BaseModel):
    primary_languages: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    databases: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    cloud_services: List[str] = Field(default_factory=list)
    architecture_preferences: List[str] = Field(default_factory=list)


class ActiveProject(BaseModel):
    name: str
    description: str = ""
    repo_url: Optional[str] = None
    live_url: Optional[str] = None
    tech_stack: List[str] = Field(default_factory=list)
    status: ProjectStatus = "active"
    current_goals: List[str] = Field(default_factory=list)
    last_updated: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PastProject(BaseModel):
    name: str
    description: str = ""
    url: Optional[str] = None
    tech_stack: List[str] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)
    completed_year: Optional[Union[str, int]] = None


class PlannedIdea(BaseModel):
    title: str
    summary: str = ""
    priority: Priority = "medium"
    tags: List[str] = Field(default_factory=list)


class FrequentPrompt(BaseModel):
    title: str
    prompt: str
    purpose: str = ""


class Preferences(BaseModel):
    code_style: Dict[str, Any] = Field(default_factory=dict)
    package_manager: str = "pnpm"
    css_framework: str = "tailwind"
    llm_instructions: str = ""


class BioVariants(BaseModel):
    short: str = ""
    medium: str = ""
    long: str = ""
    github: str = ""
    twitter: str = ""
    linkedin: str = ""
    devpost: str = ""


class UnstructuredMetadata(BaseModel):
    content: Any = None
    source_agent: str = "unknown"
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    origin_md_ref: Optional[str] = None
    tag: Optional[str] = None


class ProfileMeta(BaseModel):
    version: int = 1
    last_reconciled_md_version: int = 0
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class StoneWayProfile(BaseModel):
    identity: Identity = Field(default_factory=Identity)
    contact: Contact = Field(default_factory=Contact)
    technical_profile: TechnicalProfile = Field(default_factory=TechnicalProfile)
    active_projects: List[ActiveProject] = Field(default_factory=list)
    past_projects: List[PastProject] = Field(default_factory=list)
    planned_ideas: List[PlannedIdea] = Field(default_factory=list)
    frequent_prompts: List[FrequentPrompt] = Field(default_factory=list)
    preferences: Preferences = Field(default_factory=Preferences)
    bio_variants: BioVariants = Field(default_factory=BioVariants)
    unstructured_metadata: List[UnstructuredMetadata] = Field(default_factory=list)
    meta: ProfileMeta = Field(default_factory=ProfileMeta)


class ProfileContext(BaseModel):
    version: int
    stoneway_json: Dict[str, Any]
    stoneway_md: str
    needs_reconcile: bool = False
    unreconciled_md_excerpt: Optional[str] = None


class ProfileUpdatePayload(BaseModel):
    base_version: int
    json_patch: Optional[Dict[str, Any]] = None
    md_append: Optional[str] = None
    md_replace: Optional[str] = None
    agent_name: Optional[str] = None


class AppendNotePayload(BaseModel):
    note: str
    agent_name: Optional[str] = None


class BioQuery(BaseModel):
    platform: BioPlatform = "generic"
    tone: BioTone = "technical"
    max_length: int = 280


class ConnectorSyncResult(BaseModel):
    connector_id: str
    success: bool
    message: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    extracted_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


STARTER_STONEWAY_MD = """# StoneWay Profile Scratchpad

## Identity & Quick Intro
- **Name**: [Your Name]
- **Role**: Full-Stack Builder & Vibecoder
- **Location**: [City, Country]
- **Primary Focus**: Autonomous AI agents, Web Apps, MCP Ecosystems

## Links & Socials
- **GitHub**: https://github.com/[username]
- **Twitter / X**: https://x.com/[handle]
- **Portfolio / Live Sites**: https://[domain]

## Current Active Projects
- **Project Alpha**: Description, current blocker, vision.
- **StoneWay**: Persistent memory protocol for builders.

## Technical Stack & Preferences
- **Languages**: TypeScript, Python, SQL
- **Frameworks**: Next.js, React, Tailwind CSS, Fastify
- **Databases & Storage**: Neon PostgreSQL, Drizzle ORM
- **AI Agent Frameworks**: Model Context Protocol (MCP), Claude, Cursor

## Frequent Prompts & Persona Guidelines
- "Keep answers concise, test code before outputting, prefer TypeScript strict."

## Scratchpad & Dynamic Agent Logs
<!-- AI agents append timestamped notes and commit logs below this line -->
"""
