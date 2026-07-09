import type { RunBlock } from "@/db/schema";

/**
 * Operator-facing platform set (P5). Broader than the fleet-automation
 * `platform` enum (youtube/instagram/tiktok) — includes Facebook, Reddit, and
 * Google Business Profile, which operators manage manually. A client enables a
 * subset; the run-sheet quota cards render only the client's platforms.
 */
export type OperatorPlatform = {
  key: string;
  label: string;
  defaultCommentQuota: number;
};

export const OPERATOR_PLATFORMS: OperatorPlatform[] = [
  { key: "tiktok", label: "TikTok", defaultCommentQuota: 40 },
  { key: "instagram", label: "Instagram", defaultCommentQuota: 60 },
  { key: "youtube", label: "YouTube", defaultCommentQuota: 12 },
  { key: "facebook", label: "Facebook", defaultCommentQuota: 15 },
  { key: "reddit", label: "Reddit", defaultCommentQuota: 8 },
  { key: "gbp", label: "GBP", defaultCommentQuota: 30 },
];

export const OPERATOR_PLATFORM_KEYS = OPERATOR_PLATFORMS.map((p) => p.key);
export const OPERATOR_PLATFORM_MAP = Object.fromEntries(
  OPERATOR_PLATFORMS.map((p) => [p.key, p]),
);

/** Action types logged by operators. Only some count toward the outbound quota. */
export const ACTION_TYPES = [
  { key: "comment", label: "Outbound comment", countsToQuota: true },
  { key: "post", label: "Own post", countsToQuota: false },
  { key: "reply", label: "Reply (own post/inbound)", countsToQuota: false },
  { key: "dm", label: "Permission DM", countsToQuota: false },
  { key: "review", label: "Review response", countsToQuota: false },
  { key: "lead", label: "Lead logged", countsToQuota: false },
] as const;

export const ACTION_TYPE_MAP = Object.fromEntries(ACTION_TYPES.map((a) => [a.key, a]));

/** Default quota map for a set of enabled platform keys. */
export function defaultQuotas(platforms: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of platforms) {
    const p = OPERATOR_PLATFORM_MAP[key];
    if (p) out[key] = p.defaultCommentQuota;
  }
  return out;
}

/**
 * Default daily time-block template (mirrors the operator run-sheet screenshot).
 * Admins can edit per client; blocks are ordered around the client's peak hours.
 */
export const DEFAULT_RUN_BLOCKS: RunBlock[] = [
  { start: "08:00", end: "09:00", label: "Trend Dive brief + radar sweep #1, paste & scan the priority platforms, pick 8-12 targets", type: "watch", done: false },
  { start: "09:00", end: "09:45", label: "Posting window #1, work the queue top-down, log every action", type: "post", done: false },
  { start: "09:45", end: "10:45", label: "Inbox + own-post replies, 100% coverage, question-backs, buying-intent → lead log", type: "watch", done: false },
  { start: "10:45", end: "12:15", label: "Deep watch, watchlist creators, intent mining, UGC & mention sweep", type: "watch", done: false },
  { start: "12:15", end: "13:00", label: "Posting window #2, comments + permission DMs + review responses", type: "post", done: false },
  { start: "13:00", end: "14:00", label: "Radar sweep #2, fresh paste & scans, competitor audience, group/city threads", type: "watch", done: false },
  { start: "14:00", end: "14:45", label: "Posting window #3, final outbound, reply to replies on today's comments", type: "post", done: false },
  { start: "14:45", end: "15:30", label: "Relationship farming, Dream-100 story replies, creator warm-ups", type: "watch", done: false },
  { start: "15:30", end: "16:00", label: "Log, QA self-check, update lead sheet, note tomorrow's targets", type: "admin", done: false },
];

/** Today's date in a stable YYYY-MM-DD form (server local). */
export function todayStr(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
