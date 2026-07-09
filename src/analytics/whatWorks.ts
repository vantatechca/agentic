import { sql, and, isNotNull, gte } from "drizzle-orm";
import { db } from "@/db";
import { comments } from "@/db/schema";

/**
 * What-works feedback loop (spec §2 Module 9, §9). Aggregates posted comments by
 * tone / niche / hashtag-agnostic dimensions and ranks by earned engagement
 * (likes + replies). Feeds tone preference back into future generations and
 * surfaces top performers in the analytics dashboard.
 */

export type TonePerformance = { tone: string; count: number; avgEngagement: number };
export type NichePerformance = { nicheKey: string; count: number; avgEngagement: number };
export type TopComment = {
  id: number;
  text: string;
  tone: string | null;
  nicheKey: string;
  likes: number;
  replies: number;
};

const ENGAGE = sql<number>`coalesce((${comments.engagement}->>'likes')::int, 0) + coalesce((${comments.engagement}->>'replies')::int, 0)`;

export async function tonePerformance(sinceDays = 30): Promise<TonePerformance[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await db
    .select({
      tone: sql<string>`coalesce(${comments.tone}, 'unknown')`,
      count: sql<number>`count(*)::int`,
      avgEngagement: sql<number>`coalesce(avg(${ENGAGE}), 0)::float`,
    })
    .from(comments)
    .where(and(isNotNull(comments.postedAt), gte(comments.postedAt, since)))
    .groupBy(sql`coalesce(${comments.tone}, 'unknown')`)
    .orderBy(sql`avg(${ENGAGE}) desc nulls last`);
  return rows.map((r) => ({ tone: r.tone, count: Number(r.count), avgEngagement: round(r.avgEngagement) }));
}

export async function nichePerformance(sinceDays = 30): Promise<NichePerformance[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await db
    .select({
      nicheKey: comments.nicheKey,
      count: sql<number>`count(*)::int`,
      avgEngagement: sql<number>`coalesce(avg(${ENGAGE}), 0)::float`,
    })
    .from(comments)
    .where(and(isNotNull(comments.postedAt), gte(comments.postedAt, since)))
    .groupBy(comments.nicheKey)
    .orderBy(sql`avg(${ENGAGE}) desc nulls last`);
  return rows.map((r) => ({ nicheKey: r.nicheKey, count: Number(r.count), avgEngagement: round(r.avgEngagement) }));
}

export async function topComments(limit = 10, sinceDays = 30): Promise<TopComment[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await db
    .select({
      id: comments.id,
      text: comments.chosenText,
      tone: comments.tone,
      nicheKey: comments.nicheKey,
      engagement: comments.engagement,
    })
    .from(comments)
    .where(and(isNotNull(comments.postedAt), isNotNull(comments.engagement), gte(comments.postedAt, since)))
    .orderBy(sql`${ENGAGE} desc`)
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    text: r.text ?? "",
    tone: r.tone,
    nicheKey: r.nicheKey,
    likes: r.engagement?.likes ?? 0,
    replies: r.engagement?.replies ?? 0,
  }));
}

/** Best tone per niche — a hint the comment generator can bias toward. */
export async function bestToneByNiche(sinceDays = 30): Promise<Record<string, string>> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await db
    .select({
      nicheKey: comments.nicheKey,
      tone: sql<string>`coalesce(${comments.tone}, 'unknown')`,
      avg: sql<number>`coalesce(avg(${ENGAGE}), 0)::float`,
    })
    .from(comments)
    .where(and(isNotNull(comments.postedAt), gte(comments.postedAt, since)))
    .groupBy(comments.nicheKey, sql`coalesce(${comments.tone}, 'unknown')`)
    .orderBy(sql`${comments.nicheKey}, avg(${ENGAGE}) desc`);
  const best: Record<string, string> = {};
  for (const r of rows) {
    if (!(r.nicheKey in best)) best[r.nicheKey] = r.tone; // first per niche = highest avg
  }
  return best;
}

function round(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
