import { StorageProviderType } from "@stoneway/shared";

export interface StorageUploadResult {
  objectKey: string;
  size: number;
  sha256: string;
  etag?: string;
  provider: StorageProviderType;
}

export interface StorageDownloadResult {
  stream: ReadableStream<Uint8Array> | Buffer;
  contentType: string;
  size?: number;
  etag?: string;
}

export interface StorageHeadResult {
  exists: boolean;
  size?: number;
  contentType?: string;
  sha256?: string;
  etag?: string;
}

export interface StorageProvider {
  readonly providerName: StorageProviderType;
  upload(objectKey: string, data: Buffer, mimeType: string): Promise<StorageUploadResult>;
  download(objectKey: string): Promise<StorageDownloadResult>;
  delete(objectKey: string): Promise<void>;
  head(objectKey: string): Promise<StorageHeadResult>;
  isAvailable(): boolean;
}
