import { NextResponse } from "next/server";
import { authenticateBearerToken, getOrCreateProfile, reconcileProfile, filterProfileContext } from "@/lib/server-utils";
import {
  wrapInSafetyEnvelope,
  wrapFileInSafetyEnvelope,
  StoneWayJson,
  stonewayToJsonResume,
  renderPromptTemplate,
} from "@stoneway/shared";
import { githubConnector } from "@/lib/connectors/github";
import { decryptConfig, db, schema } from "@stoneway/database";
import { eq, and } from "drizzle-orm";
import { recordAuditEvent } from "@/lib/audit";

const MCP_TOOLS = [
  {
    name: "get_profile_context",
    description: `What it is about:
Retrieves structured developer profile (StoneWay.json) and markdown scratchpad (StoneWay.md), including active projects, tech stack, preferences, and reconciliation status.

Use this tool when:
- Answering queries about the user's background, bio, skills, active projects, or preferences.
- Planning architectures that need to match the builder's preferred technologies.
- At the start of a coding session to align with the builder's context.

Do NOT use this tool when:
- The user is asking generic programming or algorithmic questions unrelated to their profile.
- You only want to append a note (use append_note instead).
- You want a pre-formatted short bio for a social platform (use get_bio instead).`,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional search query to return only relevant excerpts and prevent context bloat.",
        },
      },
    },
  },
  {
    name: "update_profile_context",
    description: `What it is about:
Safely updates structured profile attributes and/or appends notes to StoneWay.md without data loss. Reconciles structural updates into StoneWay.json with optimistic locking.

Use this tool when:
- Updating active projects, adding newly adopted tech stacks, or modifying developer preferences.
- Reconciling unstructured scratchpad excerpts into structured StoneWay.json fields.
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
    description: `What it is about:
Quickly appends an unstructured note or milestone log to StoneWay.md.

Use this tool when:
- Logging a session summary, architecture decision, or milestone changes after completing meaningful work.
- Storing temporary scratchpad observations without altering canonical structured JSON fields.

Do NOT use this tool when:
- Modifying structured profile fields like skills, contacts, or active projects (use update_profile_context instead).
- Retrieving context (use get_profile_context instead).`,
    inputSchema: {
      type: "object",
      properties: {
        note: { type: "string", description: "Concise note or summary to append." },
        agent_name: { type: "string", description: "Identifier of the calling AI agent." },
      },
      required: ["note"],
    },
  },
  {
    name: "get_bio",
    description: `What it is about:
Synthesizes a platform-tailored developer bio from verified public context.

Use this tool when:
- The user requests a bio for Twitter/X, GitHub, LinkedIn, elevator pitch, or conference intro.

Do NOT use this tool when:
- You need the full technical stack or project details (use get_profile_context instead).`,
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["github", "x", "linkedin", "devpost", "generic"],
          description: "Target platform for the bio.",
        },
        tone: {
          type: "string",
          enum: ["casual", "technical", "founder", "minimal"],
          description: "Desired voice and tone.",
        },
        max_length: { type: "integer", description: "Character limit constraint." },
      },
    },
  },
  {
    name: "trigger_external_sync",
    description: `What it is about:
Triggers on-demand synchronization with connected external developer accounts.

Use this tool when:
- The user requests a sync from GitHub or an external provider.

Do NOT use this tool when:
- Modifying local profile notes (use update_profile_context instead).`,
    inputSchema: {
      type: "object",
      properties: {
        connector_id: { type: "string", description: "Identifier of the connector (e.g. 'github')." },
      },
      required: ["connector_id"],
    },
  },
  {
    name: "export_json_resume",
    description: `What it is about:
Exports the builder's verified profile and projects in standard JSON Resume format.

Use this tool when:
- The user asks for their resume in JSON schema or wants to export their credentials.`,
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_context_files",
    description: `What it is about:
Lists metadata for user-owned context documents (PDFs, research notes, architecture specs).

Use this tool when:
- Discovering what supplementary context files or documents the user has uploaded.
- Looking for specific project notes or career documents.

Do NOT use this tool when:
- You need the user's primary identity or stack (use get_profile_context instead).`,
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", description: "Filter by context group: career, projects, research, general" },
        tag: { type: "string", description: "Filter by tag" },
      },
    },
  },
  {
    name: "get_context_file",
    description: `What it is about:
Fetches the extracted content of a specific context file by its secure file ID.

Use this tool when:
- The user references a specific document or after discovering its ID via list_context_files or search_context.

Do NOT use this tool when:
- You want to search across all files (use search_context instead).`,
    inputSchema: {
      type: "object",
      properties: {
        file_id: { type: "string", description: "The opaque file ID (e.g. 'file_01j...')" },
      },
      required: ["file_id"],
    },
  },
  {
    name: "search_context",
    description: `What it is about:
Searches extracted passages across the user's uploaded context files and StoneWay.md scratchpad.

Use this tool when:
- Looking for specific technical details, project architecture notes, or research papers without downloading entire documents.

Do NOT use this tool when:
- Querying standard profile fields like languages or bio (use get_profile_context instead).`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term or concept to find." },
        group: { type: "string", description: "Optional context group filter (career, projects, research)." },
      },
      required: ["query"],
    },
  },
  {
    name: "list_prompts",
    description: `What it is about:
Lists user-authored custom prompts and skill templates from PROMPTS.json.

Use this tool when:
- Discovering what specialized workflows or prompts the user has created.`,
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "run_prompt",
    description: `What it is about:
Renders a user-authored prompt by name, substituting arguments and canonical profile context variables.

Use this tool when:
- Executing a user prompt found via list_prompts.`,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the prompt to render." },
        arguments: { type: "object", description: "Arguments to substitute into the template." },
      },
      required: ["name"],
    },
  },
  {
    name: "list_skills",
    description: `What it is about:
Lists specialized user skill guidelines (e.g. UI design tokens, coding standards).

Use this tool when:
- Discovering domain-specific conventions the user has defined.`,
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_skill",
    description: `What it is about:
Fetches the full instructions for a specific skill.

Use this tool when:
- Building or reviewing code that requires the user's custom standards.`,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the skill." },
      },
      required: ["name"],
    },
  },
];

export async function handleMcpHttpRequest(req: Request) {
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: authRes.error },
      },
      { status: authRes.status }
    );
  }

  const userId = authRes.context.userId;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error: Invalid JSON" },
    });
  }

  const { jsonrpc, method, params, id } = body;
  if (jsonrpc !== "2.0") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "Invalid Request: jsonrpc must be '2.0'" },
    });
  }

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
            prompts: { listChanged: true },
          },
          serverInfo: {
            name: "stoneway-remote-mcp",
            version: "0.2.0",
          },
          instructions:
            "Before answering questions about the user, their projects, or preferences, call get_profile_context. After meaningful work, call append_note with what changed.",
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
              uri: "stoneway://profile/context",
              name: "StoneWay Profile Context",
              description: "Full canonical identity and markdown memory",
              mimeType: "application/json",
            },
            {
              uri: "stoneway://scratchpad/markdown",
              name: "StoneWay Markdown Scratchpad",
              description: "Raw markdown notes and session log",
              mimeType: "text/markdown",
            },
          ],
        },
      });

    case "resources/read": {
      const uri = params?.uri;
      const profile = await getOrCreateProfile(userId);
      if (uri === "stoneway://profile/context") {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(
                  {
                    version: profile.version,
                    stoneway_json: profile.stonewayJson,
                    stoneway_md: profile.stonewayMd,
                  },
                  null,
                  2
                ),
              },
            ],
          },
        });
      }
      if (uri === "stoneway://scratchpad/markdown") {
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

    case "prompts/list": {
      const [libRecord] = await db
        .select()
        .from(schema.promptLibraries)
        .where(eq(schema.promptLibraries.userId, userId))
        .limit(1);

      const promptsList = (libRecord?.prompts || [])
        .filter((p) => p.type === "prompt")
        .map((p) => ({
          name: p.name,
          description: p.description,
          arguments: p.arguments,
        }));

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: { prompts: promptsList },
      });
    }

    case "prompts/get": {
      const promptName = params?.name;
      const promptArgs = params?.arguments || {};

      const [libRecord] = await db
        .select()
        .from(schema.promptLibraries)
        .where(eq(schema.promptLibraries.userId, userId))
        .limit(1);

      const targetPrompt = libRecord?.prompts?.find((p) => p.name === promptName && p.type === "prompt");
      if (!targetPrompt) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `Prompt '${promptName}' not found in user library.` },
        });
      }

      const profile = await getOrCreateProfile(userId);
      const rendered = renderPromptTemplate(targetPrompt.template, promptArgs, profile.stonewayJson as any);

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          description: targetPrompt.description,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: rendered,
              },
            },
          ],
        },
      });
    }

    case "tools/call": {
      const toolName = params?.name;
      const args = params?.arguments || {};
      const profile = await getOrCreateProfile(userId);

      try {
        if (toolName === "get_profile_context") {
          const { query } = args;
          const { mdExcerpt, jsonFiltered, isTruncated } = filterProfileContext(
            profile.stonewayMd,
            profile.stonewayJson as any,
            query
          );

          const payload = {
            version: profile.version,
            primary_source_stoneway_json: jsonFiltered,
            raw_markdown_stoneway_md: mdExcerpt,
            is_truncated: isTruncated,
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
          const name = json?.identity?.name || "Builder";
          const headline = json?.identity?.headline || "";
          const langs = json?.technical_profile?.primary_languages?.join(", ") || "";
          const bio = `Builder: ${name}. ${headline}. Primary stack: ${langs}.`;
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: bio }],
            },
          });
        }

        if (toolName === "trigger_external_sync") {
          const { connector_id } = args;
          if (connector_id !== "github") {
            return NextResponse.json({
              jsonrpc: "2.0",
              id,
              error: { code: -32602, message: `Unsupported connector: ${connector_id}` },
            });
          }
          const decrypted = decryptConfig<any>(profile.stonewayConfig);
          const syncRes = await githubConnector.sync(userId, decrypted);
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(syncRes, null, 2),
                },
              ],
            },
          });
        }

        if (toolName === "export_json_resume") {
          const resume = stonewayToJsonResume(profile.stonewayJson as any);
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

        if (toolName === "list_context_files") {
          const { group, tag } = args;
          const userFiles = await db
            .select()
            .from(schema.contextFiles)
            .where(eq(schema.contextFiles.userId, userId));

          let filtered = userFiles;
          if (group) filtered = filtered.filter((f) => f.contextGroup === group);
          if (tag) filtered = filtered.filter((f) => f.tags?.includes(tag));

          const summary = filtered.map((f) => ({
            id: f.id,
            filename: f.filename,
            context_group: f.contextGroup,
            tags: f.tags,
            size: f.size,
            status: f.status,
            created_at: f.createdAt.toISOString(),
          }));

          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify({ files: summary }, null, 2) }],
            },
          });
        }

        if (toolName === "get_context_file") {
          const { file_id } = args;
          const [file] = await db
            .select()
            .from(schema.contextFiles)
            .where(and(eq(schema.contextFiles.id, file_id), eq(schema.contextFiles.userId, userId)))
            .limit(1);

          if (!file) {
            return NextResponse.json({
              jsonrpc: "2.0",
              id,
              error: { code: -32602, message: `File '${file_id}' not found or unauthorized` },
            });
          }

          const wrapped = wrapFileInSafetyEnvelope({
            id: file.id,
            filename: file.filename,
            context_group: file.contextGroup,
            content: file.extractedText || `[No textual extraction available for ${file.filename}]`,
          });

          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: wrapped }],
            },
          });
        }

        if (toolName === "search_context") {
          const { query, group } = args;
          const q = (query || "").toLowerCase().trim();
          const results: Array<{ id: string; title: string; passage: string }> = [];

          const files = await db
            .select()
            .from(schema.contextFiles)
            .where(eq(schema.contextFiles.userId, userId));

          for (const f of files) {
            if (group && f.contextGroup !== group) continue;
            const text = f.extractedText || "";
            if (text.toLowerCase().includes(q)) {
              const idx = text.toLowerCase().indexOf(q);
              const start = Math.max(0, idx - 150);
              const end = Math.min(text.length, idx + q.length + 250);
              results.push({
                id: f.id,
                title: f.filename,
                passage: text.substring(start, end),
              });
            }
          }

          if (profile.stonewayMd.toLowerCase().includes(q)) {
            const idx = profile.stonewayMd.toLowerCase().indexOf(q);
            results.push({
              id: "profile_md",
              title: "StoneWay.md Scratchpad",
              passage: profile.stonewayMd.substring(Math.max(0, idx - 150), idx + q.length + 250),
            });
          }

          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: wrapInSafetyEnvelope(
                    JSON.stringify({ query, count: results.length, matches: results }, null, 2)
                  ),
                },
              ],
            },
          });
        }

        if (toolName === "list_prompts") {
          const [lib] = await db
            .select()
            .from(schema.promptLibraries)
            .where(eq(schema.promptLibraries.userId, userId))
            .limit(1);

          const prompts = (lib?.prompts || []).filter((p) => p.type === "prompt");
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify({ prompts }, null, 2) }],
            },
          });
        }

        if (toolName === "run_prompt") {
          const { name, arguments: pArgs } = args;
          const [lib] = await db
            .select()
            .from(schema.promptLibraries)
            .where(eq(schema.promptLibraries.userId, userId))
            .limit(1);

          const target = lib?.prompts?.find((p) => p.name === name);
          if (!target) {
            return NextResponse.json({
              jsonrpc: "2.0",
              id,
              error: { code: -32602, message: `Prompt '${name}' not found` },
            });
          }

          const rendered = renderPromptTemplate(target.template, pArgs || {}, profile.stonewayJson as any);
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: rendered }],
            },
          });
        }

        if (toolName === "list_skills") {
          const [lib] = await db
            .select()
            .from(schema.promptLibraries)
            .where(eq(schema.promptLibraries.userId, userId))
            .limit(1);

          const skills = (lib?.prompts || []).filter((p) => p.type === "skill");
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify({ skills }, null, 2) }],
            },
          });
        }

        if (toolName === "get_skill") {
          const { name } = args;
          const [lib] = await db
            .select()
            .from(schema.promptLibraries)
            .where(eq(schema.promptLibraries.userId, userId))
            .limit(1);

          const target = lib?.prompts?.find((p) => p.name === name && p.type === "skill");
          if (!target) {
            return NextResponse.json({
              jsonrpc: "2.0",
              id,
              error: { code: -32602, message: `Skill '${name}' not found` },
            });
          }

          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: target.template }],
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
        error: { code: -32601, message: `Method '${method}' not found` },
      });
  }
}
