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

  // Required
  DATABASE_URL: z.string().url().optional(),

  // Redis / queue
  REDIS_URL: z.string().optional(),

  // App
  ADMIN_API_TOKEN: z.string().default("change-me-in-prod"),

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
  hasRedis: Boolean(env.REDIS_URL),
  hasDeepSeek: Boolean(env.DEEPSEEK_API_KEY),
  hasClaude: Boolean(env.ANTHROPIC_API_KEY),
  hasAnyAI: Boolean(env.DEEPSEEK_API_KEY || env.ANTHROPIC_API_KEY),
  hasYouTube: Boolean(env.YOUTUBE_API_KEY),
  hasApify: Boolean(env.APIFY_TOKEN),
} as const;
