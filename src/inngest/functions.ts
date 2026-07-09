import { inngest } from "./client";
import { pollPlatform } from "@/monitoring/poll";
import { listNiches } from "@/niches/registry";
import { scanNiche } from "@/trends/scan";
import { sendDigest } from "@/trends/digest";
import { recomputeAgentStats, engagementSweep } from "@/analytics/sweep";
import { applyHealthSignal } from "@/safety/health";
import { db } from "@/db";
import { accounts, niches } from "@/db/schema";
import { and, eq, lt } from "drizzle-orm";

/** UTC helper for digest date grouping. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── YT watchlist poll — every 5 min (RSS, no quota) ───────────────────────────
export const ytPoll = inngest.createFunction(
  { id: "yt-watchlist-poll" },
  { cron: "*/5 * * * *" },
  async () => pollPlatform("youtube"),
);

// ── IG/TikTok scrape — every 20 min, jittered, circuit-breaker inside poll ────
export const igTiktokPoll = inngest.createFunction(
  { id: "ig-tiktok-watchlist-scrape" },
  { cron: "*/20 * * * *" },
  async ({ step }) => {
    const ig = await step.run("instagram", () => pollPlatform("instagram"));
    const tt = await step.run("tiktok", () => pollPlatform("tiktok"));
    return { ig, tt };
  },
);

// ── Trend scan per niche — daily 6:00 + 14:00 ET (10:00/18:00 UTC) ────────────
export const trendScan = inngest.createFunction(
  { id: "trend-scan-per-niche" },
  [{ cron: "0 10 * * *" }, { cron: "0 18 * * *" }],
  async ({ step }) => {
    const all = await listNiches();
    const date = today();
    for (const n of all) {
      await step.run(`scan-${n.key}`, () => scanNiche(n, date));
    }
    return { niches: all.length, date };
  },
);

// ── Trend digest → Discord — daily 7:00 ET (11:00 UTC) per niche ──────────────
export const trendDigest = inngest.createFunction(
  { id: "trend-digest-discord" },
  { cron: "0 11 * * *" },
  async ({ step }) => {
    const all = await listNiches();
    const date = today();
    for (const n of all) {
      await step.run(`digest-${n.key}`, () => sendDigest(n.key, date));
    }
    return { niches: all.length };
  },
);

// ── Engagement metric sweep — every 6h ────────────────────────────────────────
export const engagementSweepFn = inngest.createFunction(
  { id: "engagement-metric-sweep" },
  { cron: "0 */6 * * *" },
  async () => engagementSweep(),
);

// ── Account health recalc — hourly (gentle recovery drift + stats) ────────────
export const healthRecalc = inngest.createFunction(
  { id: "account-health-recalc" },
  { cron: "0 * * * *" },
  async ({ step }) => {
    // Gentle upward drift for cooled-down accounts that have been quiet.
    const cooled = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.status, "cooldown"), lt(accounts.healthScore, 100)));
    for (const c of cooled) {
      await step.run(`recover-${c.id}`, () => applyHealthSignal(c.id, "recover", "hourly drift"));
    }
    await step.run("agent-stats", () => recomputeAgentStats());
    return { recovered: cooled.length };
  },
);

// ── Hashtag trending-tier expiry — weekly (Mon 09:00 UTC) ─────────────────────
export const hashtagExpiry = inngest.createFunction(
  { id: "hashtag-trending-expiry" },
  { cron: "0 9 * * 1" },
  async () => {
    const now = new Date().toISOString();
    // Drop expired trending tags from each niche bank.
    const all = await db.select().from(niches);
    let cleaned = 0;
    for (const n of all) {
      const bank = n.hashtagBank;
      const before = bank.trending.length;
      bank.trending = bank.trending.filter((t) => !t.expiresAt || t.expiresAt > now);
      if (bank.trending.length !== before) {
        await db.update(niches).set({ hashtagBank: bank }).where(eq(niches.id, n.id));
        cleaned += before - bank.trending.length;
      }
    }
    return { cleaned };
  },
);

export const functions = [
  ytPoll,
  igTiktokPoll,
  trendScan,
  trendDigest,
  engagementSweepFn,
  healthRecalc,
  hashtagExpiry,
];
