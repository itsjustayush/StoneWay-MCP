import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, schema } from "@stoneway/database";
import { eq } from "drizzle-orm";
import {
  PromptLibrary,
  PromptLibrarySchema,
  convertMarkdownToPromptLibrary,
  renderPromptTemplate,
} from "@stoneway/shared";
import { getOrCreateProfile } from "@/lib/server-utils";
import { recordAuditEvent } from "@/lib/audit";
import { cacheGet, cacheSet, cacheDel, CacheKeys } from "@/lib/redis";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cacheKey = CacheKeys.prompts(session.user.id);
  const cached = await cacheGet<any>(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, ...cached, cached: true });
  }

  const [record] = await db
    .select()
    .from(schema.promptLibraries)
    .where(eq(schema.promptLibraries.userId, session.user.id))
    .limit(1);

  if (!record) {
    return NextResponse.json({
      success: true,
      library: {
        schema_version: 1,
        prompts: [],
      },
      version: 0,
    });
  }

  const responseData = {
    library: {
      schema_version: record.schemaVersion,
      prompts: record.prompts,
    },
    version: record.version,
    updated_at: record.updatedAt.toISOString(),
  };

  await cacheSet(cacheKey, responseData, 120);

  return NextResponse.json({
    success: true,
    ...responseData,
  });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  let libraryToSave: PromptLibrary;

  if (body.markdown) {
    // Import from PROMPTS.md
    libraryToSave = convertMarkdownToPromptLibrary(body.markdown);
  } else if (body.library) {
    const parsed = PromptLibrarySchema.safeParse(body.library);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid prompt library format", details: parsed.error.issues }, { status: 400 });
    }
    libraryToSave = parsed.data;
  } else {
    return NextResponse.json({ error: "Must provide library object or markdown string" }, { status: 400 });
  }

  const rawJson = JSON.stringify(libraryToSave);
  const sha256 = crypto.createHash("sha256").update(rawJson).digest("hex");

  const [existing] = await db
    .select()
    .from(schema.promptLibraries)
    .where(eq(schema.promptLibraries.userId, session.user.id))
    .limit(1);

  let newVersion = 1;
  if (existing) {
    newVersion = existing.version + 1;
    await db
      .update(schema.promptLibraries)
      .set({
        schemaVersion: libraryToSave.schema_version,
        prompts: libraryToSave.prompts,
        version: newVersion,
        sha256,
        updatedAt: new Date(),
      })
      .where(eq(schema.promptLibraries.id, existing.id));
  } else {
    await db.insert(schema.promptLibraries).values({
      userId: session.user.id,
      schemaVersion: libraryToSave.schema_version,
      prompts: libraryToSave.prompts,
      version: 1,
      sha256,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await recordAuditEvent({
    userId: session.user.id,
    event: "prompt.library_updated",
    agentLabel: "web_dashboard",
    req,
    metadata: {
      version: newVersion,
      count: libraryToSave.prompts.length,
      prompt_names: libraryToSave.prompts.map((p) => p.name),
    },
  });

  await cacheDel(CacheKeys.prompts(session.user.id));

  return NextResponse.json({
    success: true,
    library: libraryToSave,
    version: newVersion,
    sha256,
  });
}
