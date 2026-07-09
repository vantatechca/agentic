import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { watchTargets, alerts } from "@/db/schema";
import type { Platform } from "@/config/app";
import type { SourceAdapter } from "./adapters/types";
import { youtubeRssAdapter } from "./adapters/youtubeRss";
import { instagramScrapeAdapter, tiktokScrapeAdapter } from "./adapters/scrapeStub";
import { assignAlert } from "@/agent-console/assign";
import { notifyAlert, notifyFleetHealth } from "@/discord/notify";

/**
 * Watchlist polling (spec §5 crons, §3 adapter discipline).
 *
 * For each enabled, non-circuit-broken target: fetch latest via the platform
 * adapter; on new posts, create alerts + auto-assign + Discord ping. On repeated
 * failures the circuit breaker opens (backoff) and #fleet-health is notified —
 * nothing else degrades (spec's honesty note).
 */

const ADAPTERS: Record<Platform, SourceAdapter> = {
  youtube: youtubeRssAdapter,
  instagram: instagramScrapeAdapter,
  tiktok: tiktokScrapeAdapter,
};

const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 30 * 60 * 1000;

export async function pollPlatform(platform: Platform): Promise<{ checked: number; newAlerts: number }> {
  const now = new Date();
  const targets = await db
    .select()
    .from(watchTargets)
    .where(and(eq(watchTargets.platform, platform), eq(watchTargets.enabled, true)));

  const adapter = ADAPTERS[platform];
  let checked = 0;
  let newAlerts = 0;

  for (const t of targets) {
    // Skip if circuit is open
    if (t.circuitOpenUntil && t.circuitOpenUntil > now) continue;
    checked++;

    const result = await adapter.fetchLatest({
      handle: t.handle,
      channelId: t.channelId,
      lastSeenPostId: t.lastSeenPostId,
    });

    if (!result.ok) {
      const failures = t.consecutiveFailures + 1;
      const openCircuit = failures >= CIRCUIT_THRESHOLD;
      await db
        .update(watchTargets)
        .set({
          consecutiveFailures: failures,
          circuitOpenUntil: openCircuit ? new Date(now.getTime() + CIRCUIT_COOLDOWN_MS) : null,
          lastCheckedAt: now,
        })
        .where(eq(watchTargets.id, t.id));
      if (openCircuit) {
        await notifyFleetHealth(
          `🔌 Circuit opened for **${t.handle}** (${platform}) after ${failures} failures: ${result.error}. Manual-refresh mode.`,
        ).catch(() => {});
      }
      continue;
    }

    // reset failure count on success
    if (t.consecutiveFailures > 0) {
      await db
        .update(watchTargets)
        .set({ consecutiveFailures: 0, circuitOpenUntil: null })
        .where(eq(watchTargets.id, t.id));
    }

    // Find posts newer than lastSeenPostId (feed is newest-first)
    const fresh = takeUntilSeen(result.posts, t.lastSeenPostId);
    if (fresh.length) {
      // newest post id becomes the new watermark
      await db
        .update(watchTargets)
        .set({ lastSeenPostId: result.posts[0].postId, lastCheckedAt: now })
        .where(eq(watchTargets.id, t.id));

      for (const post of fresh.reverse()) {
        const inserted = await db
          .insert(alerts)
          .values({
            watchTargetId: t.id,
            platform,
            nicheKey: t.nicheKey,
            postUrl: post.url,
            postId: post.postId,
            title: post.title ?? null,
            caption: post.caption ?? null,
          })
          .onConflictDoNothing({ target: alerts.postUrl })
          .returning({ id: alerts.id });

        if (inserted[0]) {
          newAlerts++;
          const assigned = await assignAlert(inserted[0].id);
          await notifyAlert(t.nicheKey, {
            targetHandle: t.handle,
            postUrl: post.url,
            agentName: assigned.agentName ?? undefined,
            window: assigned.windowLabel ?? undefined,
          }).catch(() => {});
        }
      }
    } else {
      await db.update(watchTargets).set({ lastCheckedAt: now }).where(eq(watchTargets.id, t.id));
    }
  }

  return { checked, newAlerts };
}

/** Return posts from the top of the feed until we hit lastSeenPostId. */
function takeUntilSeen<T extends { postId: string }>(posts: T[], lastSeen?: string | null): T[] {
  if (!lastSeen) return posts.slice(0, 5); // first run: cap to avoid a flood
  const out: T[] = [];
  for (const p of posts) {
    if (p.postId === lastSeen) break;
    out.push(p);
  }
  return out;
}
