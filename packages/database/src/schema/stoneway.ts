import { pgTable, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { EncryptedEnvelope, StoneWayJson } from "@stoneway/shared";

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
