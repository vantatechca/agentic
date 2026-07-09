import type { Config } from "drizzle-kit";

// Read directly from process.env here: drizzle-kit runs outside the Next.js
// runtime, so the validated `env` module (which imports server-only helpers)
// is not appropriate at CLI time.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required for drizzle-kit. Set it in .env.");
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
} satisfies Config;
