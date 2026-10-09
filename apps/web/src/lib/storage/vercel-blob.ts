import { put, del, head } from "@vercel/blob";
import crypto from "crypto";
import { StorageProvider, StorageUploadResult, StorageDownloadResult, StorageHeadResult } from "./types";

export class VercelBlobProvider implements StorageProvider {
  readonly providerName = "vercel_blob" as const;

  isAvailable(): boolean {
    return !!process.env.BLOB_READ_WRITE_TOKEN;
  }

  async upload(objectKey: string, data: Buffer, mimeType: string): Promise<StorageUploadResult> {
    if (!this.isAvailable()) {
      throw new Error("Vercel Blob is not configured (missing BLOB_READ_WRITE_TOKEN)");
    }

    const sha256 = crypto.createHash("sha256").update(data).digest("hex");

    // Vercel Blob store put
    const blob = await put(objectKey, data, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
    });

    return {
      objectKey: blob.pathname || objectKey,
      size: data.length,
      sha256,
      provider: this.providerName,
      etag: blob.url,
    };
  }

  async download(objectKey: string): Promise<StorageDownloadResult> {
    if (!this.isAvailable()) {
      throw new Error("Vercel Blob is not configured");
    }

    const details = await head(objectKey);
    if (!details || !details.url) {
      throw new Error(`Object not found in Vercel Blob: ${objectKey}`);
    }

    const response = await fetch(details.downloadUrl || details.url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to retrieve blob from Vercel Blob (HTTP ${response.status})`);
    }

    return {
      stream: response.body,
      contentType: details.contentType || response.headers.get("content-type") || "application/octet-stream",
      size: details.size,
    };
  }

  async delete(objectKey: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await del(objectKey);
    } catch {
      // Idempotent delete
    }
  }

  async head(objectKey: string): Promise<StorageHeadResult> {
    if (!this.isAvailable()) return { exists: false };
    try {
      const details = await head(objectKey);
      return {
        exists: true,
        size: details.size,
        contentType: details.contentType,
      };
    } catch {
      return { exists: false };
    }
  }
}

export const vercelBlobProvider = new VercelBlobProvider();
