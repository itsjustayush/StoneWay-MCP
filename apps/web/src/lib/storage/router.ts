import { StorageProviderType } from "@stoneway/shared";
import { StorageProvider } from "./types";
import { vercelBlobProvider } from "./vercel-blob";
import { upstashBlobProvider } from "./upstash-blob";
import { filebaseProvider } from "./filebase";
import { db, schema } from "@stoneway/database";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export function getStorageProvider(providerName: StorageProviderType): StorageProvider {
  switch (providerName) {
    case "vercel_blob":
      return vercelBlobProvider;
    case "upstash_blob":
      return upstashBlobProvider;
    case "filebase":
      return filebaseProvider;
    default:
      return vercelBlobProvider;
  }
}

/**
 * Authoritative Storage Routing Policy:
 * 1. Large files (> 15MB) or archive containers -> Filebase (if configured)
 * 2. Specialized assets or derived previews -> Upstash Blob (if configured)
 * 3. Default standard active context documents -> Vercel Blob (if configured)
 * 4. Fallback: First available provider
 */
export function routeUpload(file: {
  filename: string;
  size: number;
  mimeType: string;
}): StorageProvider {
  // Check for large file / archival workload
  if (
    file.size > 15 * 1024 * 1024 ||
    file.filename.endsWith(".tar") ||
    file.filename.endsWith(".zip") ||
    file.filename.endsWith(".gz")
  ) {
    if (filebaseProvider.isAvailable()) return filebaseProvider;
  }

  // Check for specialized preview/derived assets
  if (file.filename.includes("preview.") || file.mimeType.startsWith("image/")) {
    if (upstashBlobProvider.isAvailable()) return upstashBlobProvider;
  }

  // Primary active context documents default to Vercel Blob
  if (vercelBlobProvider.isAvailable()) {
    return vercelBlobProvider;
  }

  // Fallbacks among configured providers
  if (upstashBlobProvider.isAvailable()) return upstashBlobProvider;
  if (filebaseProvider.isAvailable()) return filebaseProvider;

  // If none configured, return Vercel Blob which will surface standard configuration error on call
  return vercelBlobProvider;
}

/**
 * Optional Verified Cross-Provider Replication
 * Copies object from authoritative source to replica destination,
 * verifying SHA-256 before marking status as "verified".
 */
export async function replicateObject(params: {
  fileId: string;
  versionId?: string;
  sourceProvider: StorageProviderType;
  destProvider: StorageProviderType;
  objectKey: string;
  expectedSha256: string;
}): Promise<{ success: boolean; verifiedSha256?: string; error?: string }> {
  const { fileId, versionId, sourceProvider, destProvider, objectKey, expectedSha256 } = params;

  if (sourceProvider === destProvider) {
    return { success: false, error: "Source and destination providers cannot be the same" };
  }

  const src = getStorageProvider(sourceProvider);
  const dest = getStorageProvider(destProvider);

  if (!src.isAvailable() || !dest.isAvailable()) {
    return { success: false, error: "One or both storage providers are not configured" };
  }

  try {
    // 1. Download from source
    const downloadRes = await src.download(objectKey);
    const chunks: Buffer[] = [];

    if (downloadRes.stream instanceof Buffer) {
      chunks.push(downloadRes.stream);
    } else {
      const reader = (downloadRes.stream as ReadableStream<Uint8Array>).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(Buffer.from(value));
      }
    }

    const buffer = Buffer.concat(chunks);
    const downloadedSha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    if (downloadedSha256 !== expectedSha256) {
      throw new Error(`Source checksum mismatch: expected ${expectedSha256}, got ${downloadedSha256}`);
    }

    // 2. Upload to destination
    const uploadRes = await dest.upload(objectKey, buffer, downloadRes.contentType);

    if (uploadRes.sha256 !== expectedSha256) {
      throw new Error(`Destination checksum mismatch: expected ${expectedSha256}, got ${uploadRes.sha256}`);
    }

    // 3. Record verified replica in database
    await db.insert(schema.fileReplicas).values({
      fileId,
      versionId,
      sourceProvider,
      destProvider,
      destObjectKey: objectKey,
      status: "verified",
      expectedSha256,
      verifiedSha256: uploadRes.sha256,
      attemptCount: 1,
      verifiedAt: new Date(),
    });

    return { success: true, verifiedSha256: uploadRes.sha256 };
  } catch (err: any) {
    // Record failed replica attempt
    await db.insert(schema.fileReplicas).values({
      fileId,
      versionId,
      sourceProvider,
      destProvider,
      destObjectKey: objectKey,
      status: "failed",
      expectedSha256,
      attemptCount: 1,
      lastError: err.message || "Replication error",
    });

    return { success: false, error: err.message };
  }
}
