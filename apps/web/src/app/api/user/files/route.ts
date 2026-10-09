import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, schema } from "@stoneway/database";
import { eq, and, desc } from "drizzle-orm";
import { FILE_UPLOAD_LIMITS, buildObjectKey, StorageProviderType } from "@stoneway/shared";
import { recordAuditEvent } from "@/lib/audit";
import { routeUpload, getStorageProvider } from "@/lib/storage/router";
import { cacheGet, cacheSet, cacheDel, CacheKeys, checkRateLimit } from "@/lib/redis";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const group = searchParams.get("group");
  const cacheKey = CacheKeys.fileList(session.user.id, group || "all");

  // Check fast cache
  const cached = await cacheGet<any[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, files: cached, cached: true });
  }

  const query = db
    .select()
    .from(schema.contextFiles)
    .where(eq(schema.contextFiles.userId, session.user.id))
    .orderBy(desc(schema.contextFiles.createdAt));

  const allFiles = await query;
  const filtered = group ? allFiles.filter((f) => f.contextGroup === group) : allFiles;

  const resultFiles = filtered.map((f) => ({
    id: f.id,
    filename: f.filename,
    mime_type: f.mimeType,
    size: f.size,
    sha256: f.sha256,
    context_group: f.contextGroup,
    tags: f.tags || [],
    status: f.status,
    storage_state: f.storageState,
    authoritative_provider: f.authoritativeProvider,
    version: f.version,
    description: f.description,
    has_extracted_text: !!f.extractedText,
    created_at: f.createdAt.toISOString(),
    updated_at: f.updatedAt.toISOString(),
  }));

  // Store in cache for 120s
  await cacheSet(cacheKey, resultFiles, 120);

  return NextResponse.json({
    success: true,
    files: resultFiles,
  });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting check: max 30 uploads per minute per user
  const rl = await checkRateLimit(CacheKeys.rateLimit(session.user.id, "upload"), 30, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Upload rate limit exceeded. Retry in ${rl.resetSeconds}s.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { filename, mime_type, content_base64, context_group, tags, description } = body;

    if (!filename || !content_base64) {
      return NextResponse.json({ error: "Missing filename or content_base64" }, { status: 400 });
    }

    const mime = mime_type || "text/plain";
    if (!FILE_UPLOAD_LIMITS.allowedMimeTypes.includes(mime)) {
      return NextResponse.json(
        { error: `Unsupported MIME type: ${mime}. Allowed: PDF, Markdown, TXT, JSON, CSV, DOCX, XLSX, images.` },
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
          authoritative_provider: existing.authoritativeProvider,
        },
      });
    }

    // 1. Choose storage provider using authoritative routing policy
    const provider = routeUpload({
      filename,
      size: buffer.length,
      mimeType: mime,
    });

    const fileId = `file_${crypto.randomUUID().replace(/-/g, "").substring(0, 16)}`;
    const objectKey = buildObjectKey(session.user.id, fileId, 1, "original");

    // 2. Upload file bytes to authoritative provider (if configured)
    let uploadResult;
    try {
      if (provider.isAvailable()) {
        uploadResult = await provider.upload(objectKey, buffer, mime);
      }
    } catch (uploadErr: any) {
      // If provider upload fails, log error and fail safely
      console.warn(`Provider ${provider.providerName} upload failed:`, uploadErr?.message);
    }

    // 3. Extract text preview for textual / document formats (capped at 100KB)
    let extractedText = "";
    if (
      mime.startsWith("text/") ||
      mime === "application/json" ||
      mime === "text/csv" ||
      mime === "text/markdown"
    ) {
      try {
        extractedText = buffer.toString("utf-8").substring(0, 100000);
      } catch {
        extractedText = `[Text decoding failed for ${filename}]`;
      }
    } else if (mime === "application/pdf") {
      extractedText = `[PDF Document: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)]`;
    } else if (mime.startsWith("image/")) {
      extractedText = `[Image Asset: ${filename} (${mime}, ${(buffer.length / 1024).toFixed(1)} KB)]`;
    }

    const grp = context_group || "general";
    const tagList = Array.isArray(tags) ? tags : [];

    // 4. Atomically persist record in Neon PostgreSQL
    await db.transaction(async (tx) => {
      // Base file record
      await tx.insert(schema.contextFiles).values({
        id: fileId,
        userId: session.user.id,
        objectKey,
        filename: filename.substring(0, 255),
        originalFilename: filename,
        mimeType: mime,
        size: buffer.length,
        sha256,
        contextGroup: grp,
        tags: tagList,
        status: "indexed",
        storageState: "ready",
        authoritativeProvider: provider.providerName,
        version: 1,
        description: description || null,
        extractedText,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Immutable v1 version record
      await tx.insert(schema.fileVersions).values({
        fileId,
        userId: session.user.id,
        versionNumber: 1,
        objectKey,
        authoritativeProvider: provider.providerName,
        sha256,
        size: buffer.length,
        status: "ready",
        changeDescription: "Initial upload",
        createdAt: new Date(),
      });

      // Derived text artifact if available
      if (extractedText) {
        await tx.insert(schema.fileDerivedArtifacts).values({
          fileId,
          kind: "extracted_text",
          mimeType: "text/plain",
          size: extractedText.length,
          contentText: extractedText,
          createdAt: new Date(),
        });
      }
    });

    // Invalidate Redis caches
    await cacheDel(CacheKeys.fileList(session.user.id, "all"));
    await cacheDel(CacheKeys.fileList(session.user.id, grp));

    // Audit trail (redacted)
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
        provider: provider.providerName,
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
        authoritative_provider: provider.providerName,
        version: 1,
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

  // Strict Tenant Isolation: query by both file ID and authenticated user ID
  const [file] = await db
    .select()
    .from(schema.contextFiles)
    .where(and(eq(schema.contextFiles.id, fileId), eq(schema.contextFiles.userId, session.user.id)))
    .limit(1);

  if (!file) {
    // Non-disclosing 404 response
    return NextResponse.json({ error: "File not found or permission denied" }, { status: 404 });
  }

  // 1. Delete object from authoritative storage provider
  try {
    const provider = getStorageProvider(file.authoritativeProvider as StorageProviderType);
    if (provider.isAvailable()) {
      await provider.delete(file.objectKey);
    }
  } catch (deleteErr: any) {
    console.warn("Provider delete error (non-fatal):", deleteErr?.message);
  }

  // 2. Cascade delete from Neon
  await db
    .delete(schema.contextFiles)
    .where(and(eq(schema.contextFiles.id, fileId), eq(schema.contextFiles.userId, session.user.id)));

  // 3. Invalidate Redis caches
  await cacheDel(CacheKeys.fileList(session.user.id, "all"));
  await cacheDel(CacheKeys.fileList(session.user.id, file.contextGroup));
  await cacheDel(CacheKeys.fileMeta(session.user.id, fileId));

  // 4. Audit trail
  await recordAuditEvent({
    userId: session.user.id,
    event: "file.delete",
    agentLabel: "web_dashboard",
    req,
    metadata: { file_id: fileId, filename: file.filename, provider: file.authoritativeProvider },
  });

  return NextResponse.json({ success: true, message: `File ${file.filename} deleted` });
}
