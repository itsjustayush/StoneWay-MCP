import crypto from "node:crypto";
import { EncryptedEnvelope, EncryptedEnvelopeSchema } from "@stoneway/shared";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // 96-bit IV recommended for GCM

/**
 * Returns the 32-byte master encryption key buffer from environment.
 */
export function getMasterKey(customKey?: string): Buffer {
  const keyBase64 = customKey || process.env.STONEWAY_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error("Missing STONEWAY_ENCRYPTION_KEY in environment");
  }
  const keyBuffer = Buffer.from(keyBase64, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error(`STONEWAY_ENCRYPTION_KEY must be exactly 32 bytes (got ${keyBuffer.length})`);
  }
  return keyBuffer;
}

/**
 * Encrypts arbitrary serializable data using AES-256-GCM with a fresh random 96-bit IV.
 */
export function encryptConfig(data: unknown, customKey?: string): EncryptedEnvelope {
  const key = getMasterKey(customKey);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const plaintext = typeof data === "string" ? data : JSON.stringify(data);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
}

/**
 * Decrypts an AES-256-GCM envelope and verifies its authentication tag.
 */
export function decryptConfig<T = unknown>(envelope: EncryptedEnvelope, customKey?: string): T {
  EncryptedEnvelopeSchema.parse(envelope);
  const key = getMasterKey(customKey);

  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return decrypted as unknown as T;
  }
}

/**
 * Computes a deterministic SHA-256 hex digest of an API token for zero-plaintext lookup.
 */
export function hashApiKey(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

/**
 * Generates a high-entropy, base64url-encoded API key formatted as `sw_<32 random bytes>`.
 */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32);
  const base64url = randomBytes.toString("base64url");
  return `sw_${base64url}`;
}
