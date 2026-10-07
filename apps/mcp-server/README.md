# StoneWay MCP Server (`stoneway-mcp`)

The Model Context Protocol (MCP) server for **StoneWay** — providing persistent memory, builder bio generation, and automated work logging across all your AI coding agents.

Works seamlessly with:
- **Claude Desktop**
- **Claude Code** (`claude mcp add`)
- **Cursor**
- **VS Code (GitHub Copilot)**
- **Windsurf** / **Cline**
- **Codex CLI**
- **Gemini CLI**

---

## Quick Start (Stdio)

Run directly via `npx`:

```bash
npx -y stoneway-mcp
```

### Required Environment Variables

| Variable | Description | Default |
|---|---|---|
| `STONEWAY_TOKEN` | Your StoneWay developer API key (`sw_...`) | **Required** |
| `STONEWAY_API_URL` | StoneWay API endpoint | `https://stonewaymd.vercel.app/api/v1` |

Get your API key at [stonewaymd.vercel.app/app/key](https://stonewaymd.vercel.app/app/key).

---

## Agent Configuration

### 1. Claude Desktop
Add to your Claude Desktop configuration file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "stoneway": {
      "command": "npx",
      "args": ["-y", "stoneway-mcp"],
      "env": {
        "STONEWAY_TOKEN": "sw_your_api_key_here"
      }
    }
  }
}
```

### 2. Claude Code CLI
```bash
claude mcp add stoneway npx -y stoneway-mcp --env STONEWAY_TOKEN=sw_your_api_key_here
```

### 3. Cursor
Add to `.cursor/mcp.json` or your global Cursor MCP settings:

```json
{
  "mcpServers": {
    "stoneway": {
      "command": "npx",
      "args": ["-y", "stoneway-mcp"],
      "env": {
        "STONEWAY_TOKEN": "sw_your_api_key_here"
      }
    }
  }
}
```

### 4. VS Code (GitHub Copilot MCP)
Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "stoneway": {
      "command": "npx",
      "args": ["-y", "stoneway-mcp"],
      "env": {
        "STONEWAY_TOKEN": "sw_your_api_key_here"
      }
    }
  }
}
```

### 5. Windsurf / Cline
In the MCP settings UI or `mcp_settings.json`:

```json
{
  "mcpServers": {
    "stoneway": {
      "command": "npx",
      "args": ["-y", "stoneway-mcp"],
      "env": {
        "STONEWAY_TOKEN": "sw_your_api_key_here"
      }
    }
  }
}
```

### 6. Codex CLI (`config.toml`)
```toml
[mcp.servers.stoneway]
command = "npx"
args = ["-y", "stoneway-mcp"]

[mcp.servers.stoneway.env]
STONEWAY_TOKEN = "sw_your_api_key_here"
```

### 7. Gemini CLI (`settings.json`)
```json
{
  "mcpServers": {
    "stoneway": {
      "command": "npx",
      "args": ["-y", "stoneway-mcp"],
      "env": {
        "STONEWAY_TOKEN": "sw_your_api_key_here"
      }
    }
  }
}
```

---

## Standing Instructions for Agents

Agents perform best when instructed to check your StoneWay context before answering and log work after finishing. Add this rule to your `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, or `GEMINI.md`:

```markdown
Before answering anything about me, my projects, or my preferences, call StoneWay's `get_profile_context`.
After completing meaningful work or milestone changes, call StoneWay's `append_note` with a concise summary of what was accomplished.
```

---

## Available Tools

- `get_profile_context`: Fetch current profile, bio, stack, active projects, and preferences.
- `update_profile_context`: Propose structured updates to skills, projects, links, and identity.
- `append_note`: Log project milestones, session decisions, or architectural discoveries to builder memory.
- `get_bio`: Generate tailored bios for Twitter/X, GitHub, LinkedIn, elevator pitch, or conference intro.
- `trigger_external_sync`: Trigger on-demand sync from connected accounts (e.g. GitHub).
- `export_json_resume`: Export profile and verified projects in standard JSON Resume schema.

---

## License

MIT © [Ayush](https://github.com/itsjustayush)
