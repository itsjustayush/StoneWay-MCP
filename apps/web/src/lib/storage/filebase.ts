import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";
import { StorageProvider, StorageUploadResult, StorageDownloadResult, StorageHeadResult } from "./types";

export class FilebaseStorageProvider implements StorageProvider {
  readonly providerName = "filebase" as const;
  private s3Client: S3Client | null = null;

  isAvailable(): boolean {
    return !!(process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET);
  }

  private getClient(): { client: S3Client; bucket: string } {
    if (!this.isAvailable()) {
      throw new Error("Filebase is not configured (missing FILEBASE_KEY / FILEBASE_SECRET)");
    }

    if (!this.s3Client) {
      this.s3Client = new S3Client({
        endpoint: process.env.FILEBASE_ENDPOINT || "https://s3.filebase.io",
        region: "auto",
        credentials: {
          accessKeyId: process.env.FILEBASE_KEY!,
          secretAccessKey: process.env.FILEBASE_SECRET!,
        },
      });
    }

    return {
      client: this.s3Client,
      bucket: process.env.FILEBASE_BUCKET || "stoneway-context",
    };
  }

  async upload(objectKey: string, data: Buffer, mimeType: string): Promise<StorageUploadResult> {
    const { client, bucket } = this.getClient();
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
    const { client, bucket } = this.getClient();

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
      const { client, bucket } = this.getClient();
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
      const { client, bucket } = this.getClient();
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

export const filebaseProvider = new FilebaseStorageProvider();
