import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index";
import * as dotenv from "dotenv";

// Auto-load .env.local if present
dotenv.config({ path: ".env.local" });
dotenv.config();

let sqlClient: NeonQueryFunction<false, false> | null = null;
let dbInstance: any = null;

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

export function getDb() {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

// Resilient proxy: defers `createDatabase()` until an actual query method is invoked,
// preventing build-time module import crashes when DATABASE_URL is not set during prerendering!
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const instance = getDb();
    const value = (instance as any)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export type Database = typeof db;
