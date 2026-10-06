#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as dotenv from "dotenv";
import { wrapInSafetyEnvelope } from "@stoneway/shared";

dotenv.config();

const STONEWAY_TOKEN = process.env.STONEWAY_TOKEN;
const STONEWAY_API_URL = process.env.STONEWAY_API_URL || "http://localhost:3000/api/v1";

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
  "Call this first whenever you need facts, tech stacks, bio info, links, or active projects about the user. Returns structured StoneWay.json and raw StoneWay.md with reconciliation guidance.",
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
  "Safely updates structured profile attributes and/or appends notes to StoneWay.md without data loss. Reconciles structural updates into StoneWay.json.",
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
  "Quickly appends a timestamped scratchpad note, idea, or observation into StoneWay.md tagged with your agent name.",
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
  "Generates platform-tailored builder bios using STRICTLY fields marked with visibility: 'public'. Filters out private contact and location info.",
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
  "Triggers on-demand synchronization for connected integrations (GitHub, npm, Hugging Face, RSS, Notion).",
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
