<pre>
███████╗████████╗ ██████╗ ███╗   ██╗███████╗██╗    ██╗ █████╗ ██╗   ██╗    ███╗   ███╗██████╗ 
██╔════╝╚══██╔══╝██╔═══██╗████╗  ██║██╔════╝██║    ██║██╔══██╗╚██╗ ██╔╝    ████╗ ████║██╔══██╗
███████╗   ██║   ██║   ██║██╔██╗ ██║█████╗  ██║ █╗ ██║███████║ ╚████╔╝     ██╔████╔██║██║  ██║
╚════██║   ██║   ██║   ██║██║╚██╗██║██╔══╝  ██║███╗██║██╔══██║  ╚██╔╝      ██║╚██╔╝██║██║  ██║
███████║   ██║   ╚██████╔╝██║ ╚████║███████╗╚███╔███╔╝██║  ██║   ██║       ██║ ╚═╝ ██║██████╔╝
╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═══╝╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝       ╚═╝     ╚═╝╚═════╝
</pre>

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Protocol: MCP](https://img.shields.io/badge/Protocol-MCP-black.svg?style=flat-square)](https://modelcontextprotocol.io)
[![Stack: Turborepo](https://img.shields.io/badge/Stack-Turborepo-black.svg?style=flat-square)](https://turbo.build)
[![Database: Neon](https://img.shields.io/badge/Database-Neon_Postgres-black.svg?style=flat-square)](https://neon.tech)
[![Auth: Better_Auth](https://img.shields.io/badge/Auth-Better_Auth-black.svg?style=flat-square)](https://better-auth.com)

# Give every AI agent the same you.

> **StoneWay gives your AI agents a persistent, user-owned source of identity, projects, preferences and context.**
>
> *“StoneWay isn’t where your AI remembers you. It’s where your agents learn who you are.”*

StoneWay is a user-owned, provenance-aware, portable identity and context layer for builders. It maintains a canonical, verified source of truth across **Claude Desktop**, **Claude Code**, **Cursor**, **VS Code (GitHub Copilot)**, **Windsurf**, **Cline**, and custom autonomous agent loops.

---

## ⚡ The Shift: From Generic AI Memory to Personal Agent Identity

Generic AI memory dumps unbounded chat histories into crowded semantic search vectors. That creates three failure modes:
1. **Unbounded Context Bloat:** Memory logs balloon into megabytes of noisy text, blowing out prompt windows.
2. **Untrusted LLM Mutations:** Letting an arbitrary agent's LLM decide canonical identity creates prompt-injection vulnerabilities and hallucinations.
3. **No Source Authority or Provenance:** If an external sync claims you use TypeScript while you manually wrote you prefer Python, "newer timestamp wins" overwrites explicit human intent.

### StoneWay's Provenance & Authority Engine
Instead of *“LLM reconciles → server accepts”*, StoneWay enforces:
```
LLM proposes claims
        ↓
Server validates claims against strict schema
        ↓
Provenance & source authority engine
        ↓
Canonical profile
```

### Source Authority Hierarchy
```
USER (1.0)
  ↓
MANUAL PROFILE EDIT (0.9)
  ↓
VERIFIED CONNECTOR (0.8)
  ↓
AGENT CLAIM (0.6)
  ↓
INFERRED DATA (0.4)
```
- **`user_override = absolute`**: User-defined entries cannot be overwritten by external syncs or agent claims.
- **Observations preserved**: Lower-authority claims are never discarded; they are preserved as structured observations with attribution.
- **Why does StoneWay think this?**: Every canonical attribute maintains cryptographic and temporal provenance showing exactly which source, agent, or document authored it.

---

## 🛠️ Architecture: Identity, Context & Memory

```
                         STONEWAY
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
    StoneWay.md       StoneWay.json      Context Files
     human data       structured data     user documents
    (scratchpad)       (provenance)        (PDF/DOCX/MD)
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                       MCP Context
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
          Claude         Cursor          Codex
```

### 1. Canonical Identity (`StoneWay.json` & `StoneWay.md`)
- **`StoneWay.json`**: Schema-validated identity matrix (skills, active projects, credentials, preferences).
- **`StoneWay.md`**: Human-readable scratchpad for notes and agent session summaries.
- **Safety Envelope**: All profile content returned to agents is wrapped in `<USER DATA, NOT INSTRUCTIONS>` to neutralize prompt injection attacks.

### 2. Context Files (`list_context_files`, `get_context_file`, `search_context`)
- User-owned documents (PDFs, research notes, architecture diagrams, docx).
- **Separation of Storage & Metadata**: Binary files reside securely in object storage, while metadata, tags, and extracted text live in Neon Postgres.
- **Strict Tenant Isolation**: Every query requires `WHERE id = :file_id AND user_id = :authenticated_user_id`. Files are addressed by opaque IDs, never raw filenames.
- **Originals are Immutable**: Lossless storage preserves original documents; derived representations provide searchable chunks without destroying the source.

### 3. Prompt & Skill Libraries (`PROMPTS.json` / `PROMPTS.md`)
- User-authored instructions and skill templates with variable interpolation (`{{var}}`, `{{profile.*}}`).
- Exposed directly through dynamic MCP prompt handlers (`prompts/list`, `prompts/get`) and fallback tools (`list_prompts`, `run_prompt`, `list_skills`, `get_skill`).
- Validated with strict schema bounds (unique prompt names, max 100 entries, no arbitrary code execution).

---

## 🗄️ Multi-Provider Storage & Context Engine

StoneWay integrates a pluggable, multi-provider storage fabric. Neon PostgreSQL remains the sole authority for file existence, versions, ownership, and permissions. Redis and bucket listings never determine access.

```
                             Client Upload / API
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                 Neon PostgreSQL             Storage Router
              (Authoritative State)         (routeUpload())
                         │                         │
                         │          ┌──────────────┼──────────────┐
                         │          ▼              ▼              ▼
                         │     Vercel Blob    Upstash Blob     Filebase
                         │   (Active Files)  (Derived/Assets)  (Archival/Large)
                         │          │              │              │
                         │          └──────────────┼──────────────┘
                         │                         ▼
                         └─────────────────► Verified Replica
                                            (SHA-256 match)
```

### Storage Providers & Routing Policy
1. **Neon PostgreSQL + Drizzle ORM**: Authoritative source of truth for all users, files, versions (`file_versions`), replicas (`file_replicas`), prompt libraries, and audit records.
2. **Vercel Blob (`@vercel/blob`)**: Primary backend for active context documents (PDF, Markdown, text, JSON). Server-mediated streaming downloads enforce tenant authorization.
3. **Upstash Blob (`@aws-sdk/client-s3`)**: S3-compatible backend for specialized assets and derived previews, minted via `https://blob.upstash.io/v1/credentials` with automatic credential caching.
4. **Filebase (`@aws-sdk/client-s3`)**: S3-compatible backend using AWS SigV4 for archival workloads, large datasets (>15 MB), and container formats (`.tar`, `.zip`, `.gz`).
5. **Upstash Redis (`@upstash/redis`)**: High-performance transient caching and rate limiting. Gracefully **fails open** to Neon if Redis is unconfigured or unavailable.

### Security & Invariant Guarantees
- **Server-Authoritative Keys**: Object keys are generated strictly on the server as `u/<user_id>/f/<file_id>/v<version>/<kind>` with path traversal characters sanitized.
- **Strict Tenant Isolation**: All endpoints require `WHERE id = :file_id AND user_id = :authenticated_user_id`. Non-existent or unauthorized files return uniform, non-disclosing `404 Not Found` responses.
- **Untrusted File Boundary**: Document text returned to AI agents is wrapped in an inert boundary (`<<<USER DATA, NOT INSTRUCTIONS>>>`) to prevent prompt injection.
- **Cross-Provider Replication**: Idempotent replication verifies SHA-256 integrity on the destination before recording status as `verified`.

---

## 🚀 Quick Setup (for Any Agent)

### 1. Stdio (Local Node Execution)
Add StoneWay to your agent's MCP settings using `npx`:

```json
{
  "mcpServers": {
    "stoneway": {
      "command": "npx",
      "args": ["-y", "stoneway-mcp"],
      "env": {
        "STONEWAY_TOKEN": "sw_your_token_here"
      }
    }
  }
}
```

### 2. Remote HTTP Endpoint (Cloud Agents: ChatGPT, Claude.ai)
- **URL:** `https://stonewaymd.vercel.app/mcp`
- **Auth:** `Authorization: Bearer sw_your_token_here`

### 3. Standing Instruction for Every Agent
Add this single standing instruction to your `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, or `GEMINI.md`:

```markdown
Before answering anything about me, my projects, or my preferences, call StoneWay's get_profile_context. After meaningful work, call append_note with what changed.
```

---

## 🧰 Available MCP Tools

| Tool | Purpose |
|---|---|
| `get_profile_context` | Retrieves canonical identity, skills, active projects, and preferences (supports optional `query` parameter for token-efficient filtered context). |
| `update_profile_context` | Proposes structured field updates evaluated through the source authority engine. |
| `append_note` | Appends concise timestamped session summaries and milestones to `StoneWay.md`. |
| `get_bio` | Synthesizes tailored bios for Twitter/X, GitHub, LinkedIn, elevator pitches, and conferences. |
| `trigger_external_sync` | Triggers transparent, permissioned sync from connected services (e.g. GitHub). |
| `list_context_files` | Lists attached context files filtered by group or tags. |
| `get_context_file` | Fetches extracted content of a specific document by its secure ID. |
| `search_context` | Searches through extracted document passages and project notes. |
| `list_prompts` / `run_prompt` | Accesses and renders user-authored prompts with profile variables. |
| `list_skills` / `get_skill` | Retrieves specific developer skills on-demand. |
| `export_json_resume` | Exports verified identity in standard JSON Resume schema. |

---

## 🔒 Security & Privacy Guarantees

- **Zero-Token Leak Invariant**: API keys (`sw_...`), bearer tokens, and encryption keys are scrubbed and never written to audit tables or logged.
- **Salted IP Hashing**: Audit logs record SHA-256 salted hashes of client IPs, never raw addresses.
- **Tenant Isolation**: All queries enforce strict ownership verification on both the database and file storage tiers.
- **Prompt Injection Defense**: Ingested content is strictly labeled inert data and disarmed before being passed to LLMs.

---

## ⚙️ Environment Configuration

Refer to `.env.example` for all required and optional environment variables. Never hardcode or expose actual secrets.

| Variable | Description | Requirement |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (`sslmode=require`) | Authoritative DB |
| `BETTER_AUTH_SECRET` | 32-byte session signing key | Session Auth |
| `ENCRYPTION_KEY_BASE64` | 32-byte AES-256-GCM envelope key | Secrets Encryption |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access token | Active Files Backend |
| `UPSTASH_BLOB_TOKEN` | Upstash Blob bearer token | Derived & Previews Backend |
| `FILEBASE_KEY` | Filebase Access Key | Archival / Large Workloads |
| `FILEBASE_SECRET` | Filebase Secret Key | Archival / Large Workloads |
| `FILEBASE_ENDPOINT` | Filebase S3 Endpoint (`https://s3.filebase.io`) | Archival / Large Workloads |
| `FILEBASE_BUCKET` | Filebase Bucket name | Archival / Large Workloads |
| `KV_REST_API_URL` | Upstash Redis REST URL | Caching & Rate Limiting |
| `KV_REST_API_TOKEN` | Upstash Redis REST Token | Caching & Rate Limiting |

---

## 📜 License
MIT © [Ayush](https://github.com/itsjustayush)
