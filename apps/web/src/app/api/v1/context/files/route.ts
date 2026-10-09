import { NextResponse } from "next/server";
import { authenticateBearerToken } from "@/lib/server-utils";
import { db, schema } from "@stoneway/database";
import { eq, desc } from "drizzle-orm";
import { cacheGet, cacheSet, CacheKeys } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  const { searchParams } = new URL(req.url);
  const group = searchParams.get("group");
  const tag = searchParams.get("tag");

  // Fast Redis Cache Lookup
  const cacheKey = CacheKeys.fileList(authRes.context.userId, group || "all");
  const cached = await cacheGet<any[]>(cacheKey);

  if (cached && !tag) {
    return NextResponse.json({
      success: true,
      files: cached,
      cached: true,
    });
  }

  const files = await db
    .select({
      id: schema.contextFiles.id,
      filename: schema.contextFiles.filename,
      mime_type: schema.contextFiles.mimeType,
      size: schema.contextFiles.size,
      context_group: schema.contextFiles.contextGroup,
      tags: schema.contextFiles.tags,
      version: schema.contextFiles.version,
      status: schema.contextFiles.status,
      authoritative_provider: schema.contextFiles.authoritativeProvider,
      created_at: schema.contextFiles.createdAt,
    })
    .from(schema.contextFiles)
    .where(eq(schema.contextFiles.userId, authRes.context.userId))
    .orderBy(desc(schema.contextFiles.createdAt));

  let filtered = files;
  if (group) {
    filtered = filtered.filter((f) => f.context_group === group);
  }
  if (tag) {
    filtered = filtered.filter((f) => f.tags?.includes(tag));
  }

  const formatted = filtered.map((f) => ({
    ...f,
    created_at: f.created_at.toISOString(),
  }));

  // Store in Redis cache for 120s
  if (!tag) {
    await cacheSet(cacheKey, formatted, 120);
  }

  return NextResponse.json({
    success: true,
    files: formatted,
  });
}
