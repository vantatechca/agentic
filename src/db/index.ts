import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * Drizzle client over Neon's HTTP driver (serverless-friendly; works in Vercel
 * serverless and in tsx scripts — Neon HTTP is stateless).
 *
 * Lazily initialized: creating the client at import time would throw during
 * `next build` page-data collection when DATABASE_URL isn't set. Instead we
 * build it on first real use, so importing a route module never crashes the
 * build; a missing URL only errors when a query actually runs.
 */
export type DB = NeonHttpDatabase<typeof schema>;

let _db: DB | null = null;

function init(): DB {
  if (_db) return _db;
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. The database client cannot be created. See .env.example.",
    );
  }
  const sql = neon(env.DATABASE_URL);
  _db = drizzle(sql, { schema });
  return _db;
}

/** Proxy that initializes the real client on first property access. */
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const real = init();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
