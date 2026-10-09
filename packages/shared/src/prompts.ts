import { z } from "zod";

// ==========================================
// 1. Prompt Argument Schema
// ==========================================
export const PromptArgumentSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_]{1,32}$/, "Argument name must be alphanumeric"),
  description: z.string().default(""),
  required: z.boolean().default(false),
  default: z.string().optional(),
});
export type PromptArgument = z.infer<typeof PromptArgumentSchema>;

// ==========================================
// 2. Prompt / Skill Definition Schema
// ==========================================
export const PromptItemSchema = z.object({
  name: z.string().regex(/^[a-z0-9_]{1,64}$/, "Name must be lowercase alphanumeric with underscores"),
  type: z.enum(["prompt", "skill"]).default("prompt"),
  title: z.string().optional(),
  description: z.string().default(""),
  arguments: z.array(PromptArgumentSchema).default([]),
  template: z.string().max(20480, "Template must be under 20KB"),
  content_file: z.string().optional(), // Reference to context file if skill
  tags: z.array(z.string()).default([]),
});
export type PromptItem = z.infer<typeof PromptItemSchema>;

// ==========================================
// 3. Prompt Library Schema (PROMPTS.json)
// ==========================================
export const PromptLibrarySchema = z.object({
  schema_version: z.literal(1).default(1),
  prompts: z
    .array(PromptItemSchema)
    .max(100, "Maximum 100 prompts allowed per library")
    .refine((items) => {
      const names = new Set<string>();
      for (const item of items) {
        if (names.has(item.name)) return false;
        names.add(item.name);
      }
      return true;
    }, "Prompt names must be unique"),
});
export type PromptLibrary = z.infer<typeof PromptLibrarySchema>;

// ==========================================
// 4. Safe Strict Template Renderer
// ==========================================
export function renderPromptTemplate(
  template: string,
  args: Record<string, any> = {},
  profileContext: Record<string, any> = {}
): string {
  return template.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, path) => {
    // 1. Check if argument was provided
    if (path in args) {
      const val = args[path];
      return typeof val === "string" ? val : JSON.stringify(val);
    }

    // 2. Check if profile.* lookup
    if (path.startsWith("profile.")) {
      const parts = path.substring(8).split(".");
      let curr: any = profileContext;
      for (const p of parts) {
        if (curr && typeof curr === "object" && p in curr) {
          curr = curr[p];
        } else {
          curr = undefined;
          break;
        }
      }
      if (curr !== undefined) {
        if (Array.isArray(curr)) return curr.join(", ");
        return typeof curr === "string" ? curr : JSON.stringify(curr);
      }
    }

    // Default to unreplaced or empty if not supplied
    return match;
  });
}

// ==========================================
// 5. Convert PROMPTS.md -> PromptLibrary
// ==========================================
export function convertMarkdownToPromptLibrary(markdown: string): PromptLibrary {
  const prompts: PromptItem[] = [];
  // Parse markdown sections: ## [prompt_name]: [title]
  const sectionRegex = /^##\s+([a-z0-9_]+)(?::\s*([^\n]+))?/gim;
  const sections = markdown.split(/^##\s+/gm).slice(1);

  for (const section of sections) {
    const lines = section.trim().split("\n");
    const headerLine = lines[0] || "";
    const headerMatch = headerLine.match(/^([a-z0-9_]+)(?::\s*([^\n]+))?/i);
    if (!headerMatch) continue;

    const rawName = headerMatch[1]?.toLowerCase().replace(/[^a-z0-9_]/g, "_") || "";
    const title = headerMatch[2]?.trim() || rawName;
    const rest = lines.slice(1).join("\n").trim();

    // Look for fenced block for template: ```[text|prompt]?
    const codeMatch = rest.match(/```(?:prompt|markdown|text)?\n([\s\S]*?)```/);
    const template = codeMatch ? codeMatch[1].trim() : rest;

    // Look for description before code block
    const desc = codeMatch ? rest.split("```")[0].trim() : title;

    if (rawName && template) {
      prompts.push({
        name: rawName,
        type: rawName.endsWith("_skill") || rawName.startsWith("skill_") ? "skill" : "prompt",
        title,
        description: desc.substring(0, 200),
        arguments: [],
        template: template.substring(0, 20480),
        tags: ["imported-markdown"],
      });
    }
  }

  return {
    schema_version: 1,
    prompts: prompts.slice(0, 100),
  };
}
