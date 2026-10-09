import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";
import { StorageProvider, StorageUploadResult, StorageDownloadResult, StorageHeadResult } from "./types";

interface UpstashTemporaryCredentials {
  client: S3Client;
  bucket: string;
  expiresAt: number;
}

let cachedSession: UpstashTemporaryCredentials | null = null;

export class UpstashBlobProvider implements StorageProvider {
  readonly providerName = "upstash_blob" as const;

  isAvailable(): boolean {
    return !!process.env.UPSTASH_BLOB_TOKEN;
  }

  private async getS3Client(): Promise<{ client: S3Client; bucket: string }> {
    const token = process.env.UPSTASH_BLOB_TOKEN;
    if (!token) {
      throw new Error("Upstash Blob is not configured (missing UPSTASH_BLOB_TOKEN)");
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (cachedSession && cachedSession.expiresAt - 60 > nowSec) {
      return { client: cachedSession.client, bucket: cachedSession.bucket };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch("https://blob.upstash.io/v1/credentials", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Upstash credential minting failed (HTTP ${res.status})`);
      }

      const creds = await res.json();
      if (!creds.endpoint || !creds.accessKeyId || !creds.secretAccessKey) {
        throw new Error("Invalid credential response structure from Upstash");
      }

      const client = new S3Client({
        endpoint: creds.endpoint,
        region: "auto",
        credentials: {
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          sessionToken: creds.sessionToken,
        },
      });

      cachedSession = {
        client,
        bucket: creds.bucket || "upstash-blob",
        expiresAt: typeof creds.expiresAt === "number" ? creds.expiresAt : nowSec + 3600,
      };

      return { client: cachedSession.client, bucket: cachedSession.bucket };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async upload(objectKey: string, data: Buffer, mimeType: string): Promise<StorageUploadResult> {
    const { client, bucket } = await this.getS3Client();
    const sha256 = crypto.createHash("sha256").update(data).digest("hex");

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: data,
      ContentType: mimeType,
      Metadata: { sha256 },
    });

    const response = await client.send(command);

    return {
      objectKey,
      size: data.length,
      sha256,
      provider: this.providerName,
      etag: response.ETag?.replace(/"/g, ""),
    };
  }

  async download(objectKey: string): Promise<StorageDownloadResult> {
    const { client, bucket } = await this.getS3Client();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    const response = await client.send(command);
    if (!response.Body) {
      throw new Error(`Empty body returned for object ${objectKey}`);
    }

    const stream = response.Body.transformToWebStream();

    return {
      stream,
      contentType: response.ContentType || "application/octet-stream",
      size: response.ContentLength,
      etag: response.ETag?.replace(/"/g, ""),
    };
  }

  async delete(objectKey: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const { client, bucket } = await this.getS3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );
    } catch {
      // Idempotent
    }
  }

  async head(objectKey: string): Promise<StorageHeadResult> {
    if (!this.isAvailable()) return { exists: false };
    try {
      const { client, bucket } = await this.getS3Client();
      const response = await client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );

      return {
        exists: true,
        size: response.ContentLength,
        contentType: response.ContentType,
        sha256: response.Metadata?.sha256,
        etag: response.ETag?.replace(/"/g, ""),
      };
    } catch {
      return { exists: false };
    }
  }
}

export const upstashBlobProvider = new UpstashBlobProvider();
