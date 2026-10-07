#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as dotenv from "dotenv";
import { wrapInSafetyEnvelope } from "@stoneway/shared";

dotenv.config();

const STONEWAY_TOKEN = process.env.STONEWAY_TOKEN;
const rawApiUrl = process.env.STONEWAY_API_URL || "https://stonewaymd.vercel.app/api/v1";
const STONEWAY_API_URL = rawApiUrl.endsWith("/api/v1") ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, "")}/api/v1`;

if (!STONEWAY_TOKEN) {
  console.error(`
===================================================================
[StoneWay MCP Server] Error: Missing STONEWAY_TOKEN
-------------------------------------------------------------------
Please configure your STONEWAY_TOKEN in your MCP client environment.
You can get your token from your StoneWay dashboard at /app/key.

Example configuration for Claude Desktop (claude_desktop_config.json):
{
  "mcpServers": {
    "stoneway": {
      "command": "npx",
      "args": ["-y", "stoneway-mcp"],
      "env": {
        "STONEWAY_TOKEN": "sw_your_token_here",
        "STONEWAY_API_URL": "https://your-domain.vercel.app/api/v1"
      }
    }
  }
}
===================================================================
`);
  process.exit(1);
}

// Client helper for making authenticated requests to StoneWay REST API
async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  agentName = "mcp-agent"
): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
  const url = `${STONEWAY_API_URL.replace(/\/+$/, "")}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STONEWAY_TOKEN}`,
        "X-StoneWay-Agent": agentName,
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: data as T,
        error: (data as any)?.error || (data as any)?.message || `HTTP ${res.status}`,
      };
    }

    return { ok: true, status: res.status, data: data as T };
  } catch (err: any) {
    return {
      ok: false,
      status: 500,
      data: {} as T,
      error: `Network connection to StoneWay API failed (${url}): ${err.message}`,
    };
  }
}

// Initialize the MCP Server
const server = new McpServer({
  name: "stoneway-mcp",
  version: "0.1.0",
});

// ==========================================
// TOOL 1: get_profile_context
// ==========================================
server.tool(
  "get_profile_context",
  `Retrieves structured developer profile (StoneWay.json) and markdown scratchpad (StoneWay.md), including active projects, tech stack, preferences, and reconciliation status.

Use this tool when:
- The user or prompt asks about the developer's tech stack, current projects, preferences, or background.
- At the beginning of a coding session to align with the builder's preferences and active libraries.
- You need to check if there are unreconciled markdown logs that need to be merged into structured data.

Do NOT use this tool when:
- You only need a short platform-tailored bio (use get_bio instead).
- You want to record a quick note or progress entry (use append_note instead).
- The user query is completely unrelated to the developer or their projects.`,
  {},
  async () => {
    const res = await apiRequest("/profile", { method: "GET" });

    if (!res.ok) {
      return {
        content: [
          {
            type: "text",
            text: `[StoneWay Error]: Unable to retrieve profile context: ${res.error}`,
          },
        ],
        isError: true,
      };
    }

    const { stoneway_json, stoneway_md, needs_reconcile, unreconciled_md_excerpt, version } = res.data;

    const payload = JSON.stringify(
      {
        version,
        needs_reconcile,
        unreconciled_md_excerpt: needs_reconcile ? unreconciled_md_excerpt : undefined,
        reconciliation_instruction: needs_reconcile
          ? "NOTICE: StoneWay.md contains newer unstructured logs. Please parse the unreconciled_md_excerpt, extract any meaningful skills, links, or projects, and call update_profile_context with a json_patch to merge them safely."
          : "Context is synchronized.",
        primary_source_stoneway_json: stoneway_json,
        raw_markdown_stoneway_md: stoneway_md,
      },
      null,
      2
    );

    return {
      content: [
        {
          type: "text",
          text: wrapInSafetyEnvelope(payload),
        },
      ],
    };
  }
);

// ==========================================
// TOOL 2: update_profile_context
// ==========================================
server.tool(
  "update_profile_context",
  `Safely updates structured profile attributes and/or appends notes to StoneWay.md without data loss. Reconciles structural updates into StoneWay.json with optimistic locking.

Use this tool when:
- You want to update active projects, add newly adopted tech stacks, or modify developer preferences.
- You are reconciling unstructured scratchpad excerpts into structured StoneWay.json fields.
- You have a verified base_version obtained from get_profile_context.

Do NOT use this tool when:
- You only want to append a timestamped progress note without modifying structured metadata (use append_note instead).
- You do not know the current base_version (always call get_profile_context first to avoid 409 conflict).
- You want to overwrite data without respecting existing fields (StoneWay enforces zero-data-loss).`,
  {
    base_version: z.number().describe("The version number of the profile obtained from get_profile_context (required for optimistic locking)."),
    json_patch: z.record(z.any()).optional().describe("Partial structured JSON object to merge into StoneWay.json."),
    md_append: z.string().optional().describe("Text or note to append to the end of StoneWay.md."),
    agent_name: z.string().optional().describe("Optional identifier of your agent (e.g., 'claude-desktop', 'cursor', 'feature-agent')."),
  },
  async ({ base_version, json_patch, md_append, agent_name }) => {
    const res = await apiRequest(
      "/profile",
      {
        method: "PATCH",
        body: JSON.stringify({ base_version, json_patch, md_append, agent_name }),
      },
      agent_name
    );

    if (!res.ok) {
      return {
        content: [
          {
            type: "text",
            text: `[StoneWay Update Error]: ${res.error}. If conflict (409), call get_profile_context to fetch latest version and retry.`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: wrapInSafetyEnvelope(
            JSON.stringify(
              {
                success: true,
                message: "Profile updated and reconciled successfully.",
                new_version: res.data.version,
                unstructured_overflow_saved: res.data.unstructured_count || 0,
              },
              null,
              2
            )
          ),
        },
      ],
    };
  }
);

// ==========================================
// TOOL 3: append_note
// ==========================================
server.tool(
  "append_note",
  `Quickly appends a timestamped scratchpad note, idea, or observation into StoneWay.md tagged with your agent name.

Use this tool when:
- Finishing a coding task or session to log what was completed or changed.
- Capturing quick architectural thoughts, blockers, or ideas during development.
- Leaving handover notes for other AI agents or the developer.

Do NOT use this tool when:
- You need to update structured profile fields like primary_languages or active_projects (use update_profile_context instead).
- You want to read or query existing notes (use get_profile_context or stoneway://markdown instead).`,
  {
    note: z.string().min(1).describe("The observation, commit log, or note to record."),
    agent_name: z.string().optional().describe("Optional name of the agent submitting the note."),
  },
  async ({ note, agent_name }) => {
    const res = await apiRequest(
      "/notes",
      {
        method: "POST",
        body: JSON.stringify({ note, agent_name }),
      },
      agent_name
    );

    if (!res.ok) {
      return {
        content: [
          {
            type: "text",
            text: `[StoneWay Error]: Failed to append note: ${res.error}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `[StoneWay]: Note appended successfully to StoneWay.md at ${new Date().toISOString()}.`,
        },
      ],
    };
  }
);

// ==========================================
// TOOL 4: get_bio
// ==========================================
server.tool(
  "get_bio",
  `Generates platform-tailored builder bios using STRICTLY fields marked with visibility: 'public'. Filters out private contact and location info.

Use this tool when:
- The user asks: "Write my bio", "Draft my X profile", or "Update my GitHub bio".
- You need a concise, privacy-safe intro summary of the developer tailored to character limits and tone.

Do NOT use this tool when:
- You need comprehensive tech stack facts or internal project details (use get_profile_context instead).
- The user wants to edit or mutate profile data (use update_profile_context instead).`,
  {
    platform: z.enum(["github", "x", "linkedin", "devpost", "generic"]).default("generic").describe("Target platform format."),
    tone: z.enum(["casual", "technical", "founder", "minimal"]).default("technical").describe("Desired tone."),
    max_length: z.number().default(280).describe("Maximum character count constraint."),
  },
  async ({ platform, tone, max_length }) => {
    const query = new URLSearchParams({
      platform,
      tone,
      max_length: max_length.toString(),
    }).toString();

    const res = await apiRequest(`/bio?${query}`, { method: "GET" });

    if (!res.ok) {
      return {
        content: [
          {
            type: "text",
            text: `[StoneWay Error]: Unable to generate bio: ${res.error}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: wrapInSafetyEnvelope(
            JSON.stringify(
              {
                platform,
                tone,
                generated_bio: res.data.bio,
                character_count: res.data.character_count,
                public_sources_used: res.data.sources_used,
              },
              null,
              2
            )
          ),
        },
      ],
    };
  }
);

// ==========================================
// TOOL 5: trigger_external_sync
// ==========================================
server.tool(
  "trigger_external_sync",
  `Triggers on-demand synchronization for connected integrations (GitHub, npm, Hugging Face, RSS, Notion).

Use this tool when:
- The developer asks to refresh or sync their GitHub repos or external profiles into StoneWay.
- Recent external project activity needs to be imported into active projects.

Do NOT use this tool when:
- Making local agent note updates (use append_note instead).
- Reading existing synced data (use get_profile_context instead).`,
  {
    integration: z.enum(["github", "npm", "huggingface", "rss", "notion", "all"]).describe("Which connector to sync."),
  },
  async ({ integration }) => {
    const res = await apiRequest("/sync", {
      method: "POST",
      body: JSON.stringify({ integration }),
    });

    if (!res.ok) {
      return {
        content: [
          {
            type: "text",
            text: `[StoneWay Sync Error]: ${res.error}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: wrapInSafetyEnvelope(
            JSON.stringify(
              {
                integration,
                status: "success",
                result: res.data,
              },
              null,
              2
            )
          ),
        },
      ],
    };
  }
);

// ==========================================
// TOOL 6: export_json_resume
// ==========================================
server.tool(
  "export_json_resume",
  `Generates and exports the developer's StoneWay profile formatted according to the standard JSON Resume schema.

Use this tool when:
- The user asks for their resume, CV, or JSON Resume export.
- An external tool or agent requires standard JSON Resume format.

Do NOT use this tool when:
- You need raw StoneWay.json or scratchpad logs (use get_profile_context instead).`,
  {},
  async () => {
    const res = await apiRequest("/resume", { method: "GET" });

    if (!res.ok) {
      return {
        content: [
          {
            type: "text",
            text: `[StoneWay Error]: Unable to export JSON Resume: ${res.error}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(res.data, null, 2),
        },
      ],
    };
  }
);

// ==========================================
// RESOURCE: stoneway://profile
// ==========================================
server.resource(
  "stoneway_profile_resource",
  "stoneway://profile",
  async (uri) => {
    const res = await apiRequest("/profile", { method: "GET" });
    if (!res.ok) {
      throw new Error(`Failed to load StoneWay profile resource: ${res.error}`);
    }
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(res.data, null, 2),
        },
      ],
    };
  }
);

// ==========================================
// PROMPT: write_my_bio
// ==========================================
server.prompt(
  "write_my_bio",
  {
    platform: z.string().describe("Target platform (e.g. twitter, github, linkedin, hackathon)"),
    goal: z.string().optional().describe("Specific objective or emphasis of the bio"),
  },
  async ({ platform, goal }) => {
    const res = await apiRequest(`/bio?platform=${encodeURIComponent(platform)}`, { method: "GET" });
    const profileData = res.ok ? res.data : "No public profile data found.";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please draft a polished, compelling developer bio for ${platform} based strictly on my public StoneWay builder context:
${wrapInSafetyEnvelope(JSON.stringify(profileData, null, 2))}

Additional Goal: ${goal || "Accurately represent my current stack, vibe, and projects without fluff."}`,
          },
        },
      ],
    };
  }
);

// Connect stdio transport and launch
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[StoneWay MCP Server] Running and listening on stdio transport.");
}

main().catch((err) => {
  console.error("[StoneWay MCP Server] Fatal startup error:", err);
  process.exit(1);
});
