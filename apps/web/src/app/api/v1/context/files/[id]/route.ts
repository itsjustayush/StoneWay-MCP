import { NextRequest, NextResponse } from "next/server";
import { authenticateBearerToken } from "@/lib/server-utils";
import { db, schema } from "@stoneway/database";
import { eq, and } from "drizzle-orm";
import { wrapFileInSafetyEnvelope } from "@stoneway/shared";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  const { id } = await params;

  // Strict tenant isolation: verify ownership
  const [file] = await db
    .select()
    .from(schema.contextFiles)
    .where(
      and(
        eq(schema.contextFiles.id, id),
        eq(schema.contextFiles.userId, authRes.context.userId)
      )
    )
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "Context file not found or unauthorized" }, { status: 404 });
  }

  const extracted = file.extractedText || `[No textual extraction available for ${file.filename}]`;
  const wrapped = wrapFileInSafetyEnvelope({
    id: file.id,
    filename: file.filename,
    context_group: file.contextGroup,
    content: extracted,
  });

  return NextResponse.json({
    success: true,
    file_id: file.id,
    filename: file.filename,
    mime_type: file.mimeType,
    context_group: file.contextGroup,
    size: file.size,
    version: file.version,
    authoritative_provider: file.authoritativeProvider,
    safe_content: wrapped,
  });
}
