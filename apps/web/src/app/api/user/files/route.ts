import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, schema } from "@stoneway/database";
import { eq, and } from "drizzle-orm";
import { FILE_UPLOAD_LIMITS } from "@stoneway/shared";
import { recordAuditEvent } from "@/lib/audit";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const group = searchParams.get("group");

  let query = db
    .select()
    .from(schema.contextFiles)
    .where(eq(schema.contextFiles.userId, session.user.id));

  const allFiles = await query;
  const filtered = group ? allFiles.filter((f) => f.contextGroup === group) : allFiles;

  return NextResponse.json({
    success: true,
    files: filtered.map((f) => ({
      id: f.id,
      filename: f.filename,
      mime_type: f.mimeType,
      size: f.size,
      sha256: f.sha256,
      context_group: f.contextGroup,
      tags: f.tags || [],
      status: f.status,
      version: f.version,
      has_extracted_text: !!f.extractedText,
      created_at: f.createdAt.toISOString(),
      updated_at: f.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { filename, mime_type, content_base64, context_group, tags } = body;

    if (!filename || !content_base64) {
      return NextResponse.json({ error: "Missing filename or content_base64" }, { status: 400 });
    }

    const mime = mime_type || "text/plain";
    if (!FILE_UPLOAD_LIMITS.allowedMimeTypes.includes(mime)) {
      return NextResponse.json(
        { error: `Unsupported MIME type: ${mime}. Allowed: PDF, Markdown, TXT, JSON, DOCX, XLSX, images.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(content_base64, "base64");
    if (buffer.length > FILE_UPLOAD_LIMITS.maxSizeBytes) {
      return NextResponse.json(
        { error: `File size exceeds 20MB limit (size: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB)` },
        { status: 400 }
      );
    }

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    // Per-user deduplication check
    const [existing] = await db
      .select()
      .from(schema.contextFiles)
      .where(
        and(
          eq(schema.contextFiles.userId, session.user.id),
          eq(schema.contextFiles.sha256, sha256)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Identical file content already uploaded (deduplicated by SHA-256).",
        file: {
          id: existing.id,
          filename: existing.filename,
          context_group: existing.contextGroup,
          version: existing.version,
          sha256: existing.sha256,
          status: existing.status,
        },
      });
    }

    // Extract textual preview for text/markdown/json files
    let extractedText = "";
    if (
      mime.startsWith("text/") ||
      mime === "application/json" ||
      mime === "application/pdf"
    ) {
      try {
        extractedText = buffer.toString("utf-8").substring(0, 100000); // 100KB textual context cap
      } catch {
        extractedText = `[Binary content for ${filename}]`;
      }
    }

    const fileId = `file_${crypto.randomUUID().replace(/-/g, "").substring(0, 16)}`;
    const objectKey = `users/${session.user.id}/files/${fileId}/original`;
    const grp = context_group || "general";
    const tagList = Array.isArray(tags) ? tags : [];

    await db.insert(schema.contextFiles).values({
      id: fileId,
      userId: session.user.id,
      objectKey,
      filename: filename.substring(0, 255),
      mimeType: mime,
      size: buffer.length,
      sha256,
      contextGroup: grp,
      tags: tagList,
      status: "indexed",
      version: 1,
      extractedText,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await recordAuditEvent({
      userId: session.user.id,
      event: "file.upload",
      agentLabel: "web_dashboard",
      req,
      metadata: {
        file_id: fileId,
        filename,
        mime_type: mime,
        size: buffer.length,
        context_group: grp,
      },
    });

    return NextResponse.json({
      success: true,
      file: {
        id: fileId,
        filename,
        mime_type: mime,
        size: buffer.length,
        sha256,
        context_group: grp,
        tags: tagList,
        status: "indexed",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process upload" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("id");
  if (!fileId) {
    return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
  }

  // Tenant isolation: verify ownership before deletion
  const [file] = await db
    .select()
    .from(schema.contextFiles)
    .where(and(eq(schema.contextFiles.id, fileId), eq(schema.contextFiles.userId, session.user.id)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "File not found or permission denied" }, { status: 404 });
  }

  await db
    .delete(schema.contextFiles)
    .where(and(eq(schema.contextFiles.id, fileId), eq(schema.contextFiles.userId, session.user.id)));

  await recordAuditEvent({
    userId: session.user.id,
    event: "file.delete",
    agentLabel: "web_dashboard",
    req,
    metadata: { file_id: fileId, filename: file.filename },
  });

  return NextResponse.json({ success: true, message: `File ${file.filename} deleted` });
}
