import { NextResponse } from "next/server";
import { authenticateBearerToken, getOrCreateProfile } from "@/lib/server-utils";
import { db, schema } from "@stoneway/database";
import { eq } from "drizzle-orm";
import { wrapFileInSafetyEnvelope } from "@stoneway/shared";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const body = await req.json();
    const query = typeof body.query === "string" ? body.query.trim().toLowerCase() : "";
    const group = typeof body.group === "string" ? body.group : undefined;

    if (!query) {
      return NextResponse.json({ error: "Missing 'query' parameter" }, { status: 400 });
    }

    const results: Array<{
      source_type: "context_file" | "profile_scratchpad";
      id: string;
      title: string;
      group?: string;
      matched_passage: string;
    }> = [];

    // 1. Search in user's context files
    const userFiles = await db
      .select()
      .from(schema.contextFiles)
      .where(eq(schema.contextFiles.userId, authRes.context.userId));

    for (const f of userFiles) {
      if (group && f.contextGroup !== group) continue;
      const text = f.extractedText || "";
      if (text.toLowerCase().includes(query)) {
        // Extract surrounding passage
        const idx = text.toLowerCase().indexOf(query);
        const start = Math.max(0, idx - 150);
        const end = Math.min(text.length, idx + query.length + 250);
        const snippet = (start > 0 ? "..." : "") + text.substring(start, end) + (end < text.length ? "..." : "");

        results.push({
          source_type: "context_file",
          id: f.id,
          title: f.filename,
          group: f.contextGroup,
          matched_passage: snippet,
        });
      }
    }

    // 2. Search in user's StoneWay.md scratchpad
    const profile = await getOrCreateProfile(authRes.context.userId);
    const md = profile.stonewayMd || "";
    if (md.toLowerCase().includes(query)) {
      const idx = md.toLowerCase().indexOf(query);
      const start = Math.max(0, idx - 150);
      const end = Math.min(md.length, idx + query.length + 250);
      const snippet = (start > 0 ? "..." : "") + md.substring(start, end) + (end < md.length ? "..." : "");

      results.push({
        source_type: "profile_scratchpad",
        id: "profile_md",
        title: "StoneWay.md Scratchpad",
        matched_passage: snippet,
      });
    }

    return NextResponse.json({
      success: true,
      query,
      results_count: results.length,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Search failed" }, { status: 500 });
  }
}
