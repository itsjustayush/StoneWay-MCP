import { NextResponse } from "next/server";
import { authenticateBearerToken, getOrCreateProfile, reconcileProfile } from "@/lib/server-utils";
import { wrapInSafetyEnvelope, StoneWayJson, stonewayToJsonResume } from "@stoneway/shared";
import { githubConnector } from "@/lib/connectors/github";
import { decryptConfig, db, schema } from "@stoneway/database";
import { eq } from "drizzle-orm";
import { recordAuditEvent } from "@/lib/audit";

const MCP_TOOLS = [
  {
    name: "get_profile_context",
    description: `Retrieves structured developer profile (StoneWay.json) and markdown scratchpad (StoneWay.md), including active projects, tech stack, preferences, and reconciliation status.

Use this tool when:
- The user or prompt asks about the developer's tech stack, current projects, preferences, or background.
- At the beginning of a coding session to align with the builder's preferences and active libraries.
- You need to check if there are unreconciled markdown logs that need to be merged into structured data.

Do NOT use this tool when:
- You only need a short platform-tailored bio (use get_bio instead).
- You want to record a quick note or progress entry (use append_note instead).
- The user query is completely unrelated to the developer or their projects.`,
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "update_profile_context",
    description: `Safely updates structured profile attributes and/or appends notes to StoneWay.md without data loss. Reconciles structural updates into StoneWay.json with optimistic locking.

Use this tool when:
- You want to update active projects, add newly adopted tech stacks, or modify developer preferences.
- You are reconciling unstructured scratchpad excerpts into structured StoneWay.json fields.
- You have a verified base_version obtained from get_profile_context.

Do NOT use this tool when:
- You only want to append a timestamped progress note without modifying structured metadata (use append_note instead).
- You do not know the current base_version (always call get_profile_context first to avoid 409 conflict).
- You want to overwrite data without respecting existing fields (StoneWay enforces zero-data-loss).`,
    inputSchema: {
      type: "object",
      properties: {
        base_version: { type: "integer", description: "Current version of the profile context." },
        json_patch: { type: "object", description: "Structural changes to merge into StoneWay.json." },
        md_append: { type: "string", description: "Unstructured notes to append to StoneWay.md." },
        agent_name: { type: "string", description: "Identifier of the calling AI agent." },
      },
      required: ["base_version"],
    },
  },
  {
    name: "append_note",
    description: `Quickly appends a timestamped scratchpad note, idea, or observation into StoneWay.md tagged with your agent name.

Use this tool when:
- Finishing a coding task or session to log what was completed or changed.
- Capturing quick architectural thoughts, blockers, or ideas during development.
- Leaving handover notes for other AI agents or the developer.

Do NOT use this tool when:
- You need to update structured profile fields like primary_languages or active_projects (use update_profile_context instead).
- You want to read or query existing notes (use get_profile_context or stoneway://markdown instead).`,
    inputSchema: {
      type: "object",
      properties: {
        note: { type: "string", description: "The thought, summary, or note to record." },
        agent_name: { type: "string", description: "Identifier of the calling agent." },
      },
      required: ["note"],
    },
  },
  {
    name: "get_bio",
    description: `Generates platform-tailored builder bios using STRICTLY fields marked with visibility: 'public'. Filters out private contact and location info.

Use this tool when:
- The user asks: "Write my bio", "Draft my X profile", or "Update my GitHub bio".
- You need a concise, privacy-safe intro summary of the developer tailored to character limits and tone.

Do NOT use this tool when:
- You need comprehensive tech stack facts or internal project details (use get_profile_context instead).
- The user wants to edit or mutate profile data (use update_profile_context instead).`,
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["github", "x", "linkedin", "devpost", "generic"],
          default: "generic",
        },
        tone: {
          type: "string",
          enum: ["casual", "technical", "founder", "minimal"],
          default: "technical",
        },
        max_length: { type: "integer", default: 280 },
      },
    },
  },
  {
    name: "trigger_external_sync",
    description: `Triggers on-demand synchronization for connected integrations (GitHub, npm, Hugging Face, RSS, Notion).

Use this tool when:
- The developer asks to refresh or sync their GitHub repos or external profiles into StoneWay.
- Recent external project activity needs to be imported into active projects.

Do NOT use this tool when:
- Making local agent note updates (use append_note instead).
- Reading existing synced data (use get_profile_context instead).`,
    inputSchema: {
      type: "object",
      properties: {
        integration: { type: "string", default: "github" },
      },
    },
  },
  {
    name: "export_json_resume",
    description: `Generates and exports the developer's StoneWay profile formatted according to the standard JSON Resume schema.

Use this tool when:
- The user asks for their resume, CV, or JSON Resume export.
- An external tool or agent requires standard JSON Resume format.

Do NOT use this tool when:
- You need raw StoneWay.json or scratchpad logs (use get_profile_context instead).`,
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export async function handleMcpHttpRequest(req: Request) {
  // Support GET discovery
  if (req.method === "GET") {
    return NextResponse.json({
      name: "stoneway-mcp",
      version: "0.1.0",
      status: "ready",
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false },
      },
      docs: "https://stonewaymd.vercel.app/docs",
    });
  }

  // Authenticate bearer token
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: authRes.error },
      },
      { status: authRes.status }
    );
  }

  const userId = authRes.context.userId;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 }
    );
  }

  const { id, method, params } = body;

  switch (method) {
    case "initialize":
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: {
            name: "stoneway-mcp",
            version: "0.1.0",
          },
        },
      });

    case "tools/list":
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: { tools: MCP_TOOLS },
      });

    case "resources/list":
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          resources: [
            {
              uri: "stoneway://profile",
              name: "StoneWay Profile JSON",
              mimeType: "application/json",
              description: "Structured developer profile in StoneWay.json format",
            },
            {
              uri: "stoneway://markdown",
              name: "StoneWay Markdown Scratchpad",
              mimeType: "text/markdown",
              description: "Raw developer scratchpad in StoneWay.md format",
            },
          ],
        },
      });

    case "resources/read": {
      const uri = params?.uri;
      const profile = await getOrCreateProfile(userId);
      if (uri === "stoneway://profile") {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(profile.stonewayJson, null, 2),
              },
            ],
          },
        });
      }
      if (uri === "stoneway://markdown") {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: profile.stonewayMd,
              },
            ],
          },
        });
      }
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: `Resource '${uri}' not found` },
      });
    }

    case "prompts/list":
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          prompts: [
            {
              name: "write_my_bio",
              description: "Draft a polished developer bio based strictly on public builder context",
              arguments: [
                { name: "platform", description: "Target platform (github, x, linkedin)", required: false },
              ],
            },
          ],
        },
      });

    case "tools/call": {
      const toolName = params?.name;
      const args = params?.arguments || {};
      const profile = await getOrCreateProfile(userId);

      try {
        if (toolName === "get_profile_context") {
          const payload = {
            version: profile.version,
            primary_source_stoneway_json: profile.stonewayJson,
            raw_markdown_stoneway_md: profile.stonewayMd,
          };
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: wrapInSafetyEnvelope(JSON.stringify(payload, null, 2)),
                },
              ],
            },
          });
        }

        if (toolName === "update_profile_context") {
          const { base_version, json_patch, md_append, agent_name } = args;
          const { updatedProfile } = await reconcileProfile(profile, {
            baseVersion: base_version,
            jsonPatch: json_patch,
            mdAppend: md_append,
            agentName: agent_name || "remote_mcp_agent",
          });
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: wrapInSafetyEnvelope(
                    JSON.stringify({ success: true, version: updatedProfile.version }, null, 2)
                  ),
                },
              ],
            },
          });
        }

        if (toolName === "append_note") {
          const { note, agent_name } = args;
          const { updatedProfile } = await reconcileProfile(profile, {
            baseVersion: profile.version,
            mdAppend: note,
            agentName: agent_name || "remote_mcp_agent",
          });
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `[StoneWay]: Note appended successfully. Version: v${updatedProfile.version}`,
                },
              ],
            },
          });
        }

        if (toolName === "get_bio") {
          const json = profile.stonewayJson as StoneWayJson;
          const platform = args.platform || "generic";
          const bioVariant =
            json.bio_variants?.[platform as keyof typeof json.bio_variants] ||
            json.bio_variants?.short ||
            json.identity?.bio ||
            "Builder exploring AI agents.";
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: wrapInSafetyEnvelope(
                    JSON.stringify({ platform, bio: bioVariant }, null, 2)
                  ),
                },
              ],
            },
          });
        }

        if (toolName === "export_json_resume") {
          const resume = stonewayToJsonResume(profile.stonewayJson as StoneWayJson);
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(resume, null, 2),
                },
              ],
            },
          });
        }

        if (toolName === "trigger_external_sync") {
          const integration = args.integration || "github";
          const [user] = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, userId))
            .limit(1);

          const decrypted = decryptConfig<any>(profile.stonewayConfig);
          const githubHandle =
            (profile.stonewayJson as any)?.identity?.handle ||
            user?.name?.replace(/\s+/g, "").toLowerCase() ||
            "itsjustayush";

          const syncRes = await githubConnector.sync(githubHandle, decrypted);
          if (syncRes.success && syncRes.extracted_data) {
            await reconcileProfile(profile, {
              baseVersion: profile.version,
              jsonPatch: {
                active_projects: syncRes.extracted_data.active_projects,
                technical_profile: {
                  primary_languages: syncRes.extracted_data.primary_languages,
                },
              },
              agentName: "remote_mcp_sync",
            });
          }

          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: wrapInSafetyEnvelope(JSON.stringify(syncRes, null, 2)),
                },
              ],
            },
          });
        }

        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method or tool '${toolName}' not found` },
        });
      } catch (err: any) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32000, message: err.message },
        });
      }
    }

    default:
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method '${method}' not recognized` },
      });
  }
}
