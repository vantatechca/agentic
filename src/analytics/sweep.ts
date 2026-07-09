import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, agents, engagementLog, alerts } from "@/db/schema";
import { fetchYouTubeCommentMetrics } from "./metrics";
import { applyHealthSignal } from "@/safety/health";

/**
 * Analytics (spec §2 Module 9, §9 per-agent stats, P4).
 *
 * - recomputeAgentStats: avg claim-to-posted time, comments/day, engagement
 *   earned — same stats pattern the spec references from Chat Support Pro.
 * - engagementSweep: hook point for the 6h metric sweep (P4). Live metric pulls
 *   land here per platform; for now it recomputes derived aggregates.
 */

export async function recomputeAgentStats(): Promise<number> {
  const allAgents = await db.select({ id: agents.id }).from(agents);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const a of allAgents) {
    // comments in last 24h attributed via alert.assignedAgentId
    const [{ count: commentsPerDay }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .innerJoin(alerts, eq(comments.alertId, alerts.id))
      .where(and(eq(alerts.assignedAgentId, a.id), gte(comments.postedAt, dayAgo)));

    // avg claim -> posted time (seconds)
    const [{ avgSec }] = await db
      .select({
        avgSec: sql<number>`coalesce(avg(extract(epoch from (${comments.postedAt} - ${alerts.detectedAt})))::int, 0)`,
      })
      .from(comments)
      .innerJoin(alerts, eq(comments.alertId, alerts.id))
      .where(and(eq(alerts.assignedAgentId, a.id), isNotNull(comments.postedAt)));

    const [{ totalComments }] = await db
      .select({ totalComments: sql<number>`count(*)::int` })
      .from(comments)
      .innerJoin(alerts, eq(comments.alertId, alerts.id))
      .where(eq(alerts.assignedAgentId, a.id));

    await db
      .update(agents)
      .set({
        stats: {
          avgClaimTimeSec: Number(avgSec) || 0,
          commentsPerDay: Number(commentsPerDay) || 0,
          totalComments: Number(totalComments) || 0,
        },
      })
      .where(eq(agents.id, a.id));
  }
  return allAgents.length;
}

/**
 * Engagement sweep (P4, spec §5 every 6h). Re-polls live metrics for API-posted
 * comments that carry a platform comment id, writes engagement_log rows, and
 * feeds the health signals:
 *   - a previously-nonzero comment now reading zero  → engagement_zero
 *   - a comment the platform no longer returns       → comment_missing
 * Manual comments (no platform id) are counted but can't be re-polled — the
 * sweep stays honest and skips them rather than inventing zeros.
 */
export async function engagementSweep(): Promise<{ scanned: number; repolled: number }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await db
    .select({
      id: comments.id,
      accountId: comments.accountId,
      platformCommentId: comments.platformCommentId,
      engagement: comments.engagement,
    })
    .from(comments)
    .where(and(isNotNull(comments.postedAt), gte(comments.postedAt, since)))
    .limit(500);

  let repolled = 0;
  for (const c of recent) {
    if (!c.platformCommentId) continue; // can only re-poll API-posted (YT) comments
    const metrics = await fetchYouTubeCommentMetrics(c.platformCommentId);
    if (!metrics) continue;
    repolled++;

    const prev = c.engagement;
    await db
      .update(comments)
      .set({ engagement: { likes: metrics.likes, replies: metrics.replies } })
      .where(eq(comments.id, c.id));
    await db.insert(engagementLog).values([
      { commentId: c.id, metric: "likes", value: metrics.likes },
      { commentId: c.id, metric: "replies", value: metrics.replies },
    ]);

    // Health signals
    if (metrics.missing) {
      await applyHealthSignal(c.accountId, "comment_missing", `comment ${c.id} gone`).catch(() => {});
    } else if (prev && prev.likes + prev.replies > 0 && metrics.likes + metrics.replies === 0) {
      await applyHealthSignal(c.accountId, "engagement_zero", `comment ${c.id} dropped to 0`).catch(() => {});
    }
  }
  return { scanned: recent.length, repolled };
}
