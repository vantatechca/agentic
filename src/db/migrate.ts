import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-http/migrator";

/**
 * Applies generated SQL migrations from ./drizzle. Run with `npm run db:migrate`.
 * For quick local iteration `npm run db:push` (drizzle-kit push) is also fine.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to run migrations.");
  const sql = neon(url);
  const db = drizzle(sql);
  console.log("Running migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ Migrations complete.");
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
