import { z } from "zod";

/**
 * Centralized, validated environment access.
 *
 * Philosophy (from the spec's "free-scrape honesty note" and phased rollout):
 * only DATABASE_URL is truly required to boot. Everything else is optional and
 * features gracefully degrade when a key is missing — e.g. no Discord webhook
 * => alerts are logged instead of sent; no AI key => generator throws a clear
 * error only when actually invoked. This keeps local dev and partial
 * deployments alive.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Required — also backs the job queue (pg-boss); no Redis needed.
  DATABASE_URL: z.string().url().optional(),

  // App
  ADMIN_API_TOKEN: z.string().default("change-me-in-prod"),
  // Auth (P5): signs session cookies. Defaults to the admin token so the app
  // still boots; set a dedicated strong secret in production.
  SESSION_SECRET: z.string().optional(),
  // Initial admin seeded by `npm run db:seed` when no users exist.
  ADMIN_EMAIL: z.string().default("admin@agentic.local"),
  ADMIN_PASSWORD: z.string().default("changeme123"),

  // AI providers
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),

  // Discord
  DISCORD_WEBHOOK_ALERTS: z.string().optional(),
  DISCORD_WEBHOOK_TRENDS: z.string().optional(),
  DISCORD_WEBHOOK_FLEET_HEALTH: z.string().optional(),

  // Inngest
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // Platform APIs
  YOUTUBE_API_KEY: z.string().optional(),
  IG_GRAPH_API_TOKEN: z.string().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),

  // Scrapers
  APIFY_TOKEN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail loud with a readable summary rather than a cryptic stack later.
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration. See .env.example.");
}

export const env = parsed.data;

/** Small capability flags derived from which keys are present. */
export const capabilities = {
  hasDb: Boolean(env.DATABASE_URL),
  // The queue (pg-boss) runs on Postgres, so it's available whenever the DB is.
  hasQueue: Boolean(env.DATABASE_URL),
  hasDeepSeek: Boolean(env.DEEPSEEK_API_KEY),
  hasClaude: Boolean(env.ANTHROPIC_API_KEY),
  hasAnyAI: Boolean(env.DEEPSEEK_API_KEY || env.ANTHROPIC_API_KEY),
  hasYouTube: Boolean(env.YOUTUBE_API_KEY),
  hasApify: Boolean(env.APIFY_TOKEN),
} as const;
