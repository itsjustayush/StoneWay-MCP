import { pgTable, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { EncryptedEnvelope, StoneWayJson, Observation, PromptItem } from "@stoneway/shared";

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  stonewayMd: text("stoneway_md").notNull().default(""),
  stonewayJson: jsonb("stoneway_json").$type<StoneWayJson>().notNull(),
  stonewayConfig: jsonb("stoneway_config").$type<EncryptedEnvelope>().notNull(),
  version: integer("version").notNull().default(1),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull().default("sw_"),
  name: text("name").notNull().default("Unified Agent Key"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
});

export const revisions = pgTable("revisions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  fileType: text("file_type").$type<"md" | "json">().notNull(),
  content: text("content").notNull(),
  diff: text("diff"),
  agentLabel: text("agent_label").notNull().default("user"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  agentLabel: text("agent_label").notNull().default("web"),
  ipHash: text("ip_hash"),
  requestId: text("request_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const provenanceRecords = pgTable("provenance_records", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  canonicalValue: jsonb("canonical_value"),
  canonicalSource: text("canonical_source").notNull(),
  canonicalSourceType: text("canonical_source_type").notNull(),
  sourceAgent: text("source_agent"),
  sourceDocument: text("source_document"),
  confidence: text("confidence").notNull().default("1.0"),
  userOverride: boolean("user_override").notNull().default(false),
  observations: jsonb("observations").$type<Observation[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const contextFiles = pgTable("context_files", {
  id: text("id").primaryKey().$defaultFn(() => `file_${crypto.randomUUID().replace(/-/g, "").substring(0, 16)}`),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  contextGroup: text("context_group").notNull().default("general"),
  tags: jsonb("tags").$type<string[]>().default([]),
  status: text("status").notNull().default("quarantine"),
  version: integer("version").notNull().default(1),
  extractedText: text("extracted_text"),
  authoritativeProvider: text("authoritative_provider").notNull().default("vercel_blob"),
  storageState: text("storage_state").notNull().default("ready"),
  originalFilename: text("original_filename"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const fileVersions = pgTable("file_versions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  fileId: text("file_id")
    .notNull()
    .references(() => contextFiles.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  objectKey: text("object_key").notNull(),
  authoritativeProvider: text("authoritative_provider").notNull().default("vercel_blob"),
  sha256: text("sha256").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull().default("ready"),
  changeDescription: text("change_description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fileReplicas = pgTable("file_replicas", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  fileId: text("file_id")
    .notNull()
    .references(() => contextFiles.id, { onDelete: "cascade" }),
  versionId: text("version_id").references(() => fileVersions.id, { onDelete: "cascade" }),
  sourceProvider: text("source_provider").notNull(),
  destProvider: text("dest_provider").notNull(),
  destObjectKey: text("dest_object_key").notNull(),
  status: text("status").notNull().default("pending"), // pending | verified | failed
  expectedSha256: text("expected_sha256").notNull(),
  verifiedSha256: text("verified_sha256"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastError: text("last_error"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fileDerivedArtifacts = pgTable("file_derived_artifacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  fileId: text("file_id")
    .notNull()
    .references(() => contextFiles.id, { onDelete: "cascade" }),
  versionId: text("version_id").references(() => fileVersions.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // extracted_text | search_chunks | preview_webp
  objectKey: text("object_key"),
  provider: text("provider"),
  mimeType: text("mime_type").notNull(),
  size: integer("size"),
  contentText: text("content_text"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const promptLibraries = pgTable("prompt_libraries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  schemaVersion: integer("schema_version").notNull().default(1),
  prompts: jsonb("prompts").$type<PromptItem[]>().notNull().default([]),
  version: integer("version").notNull().default(1),
  sha256: text("sha256"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
