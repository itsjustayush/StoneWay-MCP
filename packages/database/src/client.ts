import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index";
import * as dotenv from "dotenv";

// Auto-load .env.local if present in development
dotenv.config();

let sqlClient: NeonQueryFunction<false, false> | null = null;

export function getSql(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }
  if (!sqlClient) {
    sqlClient = neon(url);
  }
  return sqlClient;
}

export function createDatabase(connectionString?: string) {
  const sql = getSql(connectionString);
  return drizzle(sql, { schema });
}

export const db = createDatabase();
export type Database = typeof db;
