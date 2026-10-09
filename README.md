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

## 📜 License
MIT © [Ayush](https://github.com/itsjustayush)
