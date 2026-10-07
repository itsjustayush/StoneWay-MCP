import { db, schema } from "@stoneway/database";
import crypto from "crypto";

export type AuditEventType =
  | "auth.login"
  | "auth.logout"
  | "account.delete"
  | "key.create"
  | "key.reveal"
  | "key.regenerate"
  | "key.revoke"
  | "integration.add"
  | "integration.change"
  | "integration.remove"
  | "profile.write"
  | "profile.restore"
  | "profile.wipe"
  | "sync.trigger"
  | "sync.complete"
  | "sync.error"
  | "auth.failure";

/**
 * Anonymously hashes IP addresses with SHA-256 and a constant pepper to protect user privacy.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip + "stoneway_pepper_v1").digest("hex").slice(0, 16);
}

/**
 * Extracts client IP from Request headers.
 */
export function getClientIp(req?: Request): string | null {
  if (!req) return null;
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip");
}

/**
 * SECURITY FILTER: Sanitizes metadata to ensure sensitive secrets, raw bodies,
 * tokens, or DB parameter dumps are NEVER written to the audit log.
 */
function sanitizeMetadata(rawMeta?: Record<string, unknown>): Record<string, unknown> {
  if (!rawMeta || typeof rawMeta !== "object") return {};

  const forbiddenKeys = [
    "authorization",
    "token",
    "key",
    "secret",
    "password",
    "pat",
    "stoneway_md",
    "stoneway_json",
    "body",
    "ciphertext",
    "encryption_key",
    "github_pat",
    "notion_token",
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(rawMeta)) {
    const lowerKey = k.toLowerCase();
    if (forbiddenKeys.some((f) => lowerKey.includes(f))) {
      // Redact or omit sensitive keys
      sanitized[k] = "[REDACTED]";
      continue;
    }

    if (v instanceof Error) {
      sanitized[k] = `${v.name}: ${v.message.slice(0, 120)}`;
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeMetadata(v as Record<string, unknown>);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}

export interface RecordAuditOptions {
  userId: string;
  event: AuditEventType;
  agentLabel?: string;
  req?: Request;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records an append-only audit event. Enforces zero credential leakage.
 */
export async function recordAuditEvent(opts: RecordAuditOptions): Promise<void> {
  try {
    const rawIp = opts.req ? getClientIp(opts.req) : null;
    const ipHash = rawIp ? hashIp(rawIp) : null;
    const agentHeader = opts.req?.headers.get("x-stoneway-agent") || opts.agentLabel || "web";
    const reqId = opts.requestId || opts.req?.headers.get("x-request-id") || crypto.randomUUID().slice(0, 8);

    await db.insert(schema.auditEvents).values({
      userId: opts.userId,
      event: opts.event,
      agentLabel: agentHeader,
      ipHash,
      requestId: reqId,
      metadata: sanitizeMetadata(opts.metadata),
    });
  } catch (err) {
    // Non-blocking: audit failure should never crash user transactions
    console.error("[StoneWay Audit] Failed to record event:", err);
  }
}
