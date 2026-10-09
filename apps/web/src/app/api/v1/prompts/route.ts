import { NextResponse } from "next/server";
import { authenticateBearerToken, getOrCreateProfile } from "@/lib/server-utils";
import { db, schema } from "@stoneway/database";
import { eq } from "drizzle-orm";
import { renderPromptTemplate } from "@stoneway/shared";
import { recordAuditEvent } from "@/lib/audit";

import { cacheGet, cacheSet, CacheKeys } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  const cacheKey = CacheKeys.prompts(authRes.context.userId);
  const cached = await cacheGet<any>(cacheKey);
  if (cached?.prompts) {
    return NextResponse.json({
      success: true,
      prompts: cached.prompts,
      skills: cached.skills || [],
      cached: true,
    });
  }

  const [record] = await db
    .select()
    .from(schema.promptLibraries)
    .where(eq(schema.promptLibraries.userId, authRes.context.userId))
    .limit(1);

  if (!record) {
    return NextResponse.json({
      success: true,
      prompts: [],
      skills: [],
    });
  }

  const all = record.prompts || [];
  const prompts = all.filter((p) => p.type === "prompt");
  const skills = all.filter((p) => p.type === "skill");

  await cacheSet(cacheKey, { prompts, skills }, 120);

  return NextResponse.json({
    success: true,
    prompts,
    skills,
  });
}

export async function POST(req: Request) {
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const body = await req.json();
    const { name, arguments: promptArgs } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing prompt 'name'" }, { status: 400 });
    }

    const [record] = await db
      .select()
      .from(schema.promptLibraries)
      .where(eq(schema.promptLibraries.userId, authRes.context.userId))
      .limit(1);

    if (!record) {
      return NextResponse.json({ error: "No prompt library registered for this user" }, { status: 404 });
    }

    const prompt = record.prompts.find((p) => p.name === name);
    if (!prompt) {
      return NextResponse.json({ error: `Prompt '${name}' not found` }, { status: 404 });
    }

    const profile = await getOrCreateProfile(authRes.context.userId);
    const rendered = renderPromptTemplate(prompt.template, promptArgs || {}, profile.stonewayJson as any);

    await recordAuditEvent({
      userId: authRes.context.userId,
      event: "prompt.rendered",
      agentLabel: req.headers.get("x-stoneway-agent") || "mcp_client",
      req,
      metadata: { prompt_name: name, prompt_type: prompt.type },
    });

    return NextResponse.json({
      success: true,
      name: prompt.name,
      type: prompt.type,
      title: prompt.title,
      rendered_content: rendered,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to render prompt" }, { status: 500 });
  }
}
