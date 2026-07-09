import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, agents, engagementLog, alerts } from "@/db/schema";

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
 * Engagement sweep (P4). In production this pulls fresh metrics from each
 * platform for recently-posted comments/posts and writes engagement_log rows,
 * then feeds the health signals (engagement_zero) and what-works loop.
 */
export async function engagementSweep(): Promise<{ scanned: number }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await db
    .select({ id: comments.id, engagement: comments.engagement })
    .from(comments)
    .where(and(isNotNull(comments.postedAt), gte(comments.postedAt, since)))
    .limit(500);

  // TODO(P4): fetch live metrics per platform and upsert engagement_log rows.
  for (const c of recent) {
    if (c.engagement) {
      await db.insert(engagementLog).values([
        { commentId: c.id, metric: "likes", value: c.engagement.likes ?? 0 },
        { commentId: c.id, metric: "replies", value: c.engagement.replies ?? 0 },
      ]);
    }
  }
  return { scanned: recent.length };
}
