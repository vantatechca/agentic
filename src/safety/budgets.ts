import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, comments } from "@/db/schema";
import { DEFAULTS } from "@/config/app";

/**
 * Per-account budgets (spec §6.3): daily comment cap, min-gap between actions.
 * Checked before an agent is allowed to post/paste a comment for an account.
 */

export type BudgetCheck = {
  ok: boolean;
  reason: string | null;
  usedToday: number;
  budget: number;
};

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Can this account take another commenting action right now? */
export async function checkCommentBudget(
  accountId: number,
  now: Date = new Date(),
): Promise<BudgetCheck> {
  const [acct] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!acct) return { ok: false, reason: "account not found", usedToday: 0, budget: 0 };

  if (acct.status !== "active") {
    return {
      ok: false,
      reason: `account is ${acct.status}`,
      usedToday: 0,
      budget: acct.dailyCommentBudget,
    };
  }

  // min-gap between actions
  if (acct.lastActionAt) {
    const gap = now.getTime() - acct.lastActionAt.getTime();
    if (gap < DEFAULTS.minActionGapMs) {
      const waitMin = Math.ceil((DEFAULTS.minActionGapMs - gap) / 60_000);
      return {
        ok: false,
        reason: `min-gap not elapsed (wait ~${waitMin}m)`,
        usedToday: 0,
        budget: acct.dailyCommentBudget,
      };
    }
  }

  const dayStart = startOfUtcDay(now);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(
      and(
        eq(comments.accountId, accountId),
        gte(comments.postedAt, dayStart),
      ),
    );

  const usedToday = Number(count) || 0;
  if (usedToday >= acct.dailyCommentBudget) {
    return {
      ok: false,
      reason: `daily comment budget reached (${usedToday}/${acct.dailyCommentBudget})`,
      usedToday,
      budget: acct.dailyCommentBudget,
    };
  }

  return { ok: true, reason: null, usedToday, budget: acct.dailyCommentBudget };
}

/**
 * One-account-one-video rule (spec §6.6): max 1 fleet comment per video per
 * niche by default. Returns false (blocked) if a fleet comment already exists
 * for this video within the niche, unless override allows a 2nd (different
 * account, enforced by caller supplying a distinct accountId).
 */
export async function checkOneCommentPerVideo(
  videoUrl: string,
  nicheKey: string,
  opts: { maxPerVideo?: number } = {},
): Promise<{ ok: boolean; reason: string | null; existing: number }> {
  const max = opts.maxPerVideo ?? 1;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(and(eq(comments.videoUrl, videoUrl), eq(comments.nicheKey, nicheKey)));
  const existing = Number(count) || 0;
  if (existing >= max) {
    return {
      ok: false,
      reason: `one-comment-per-video: ${existing}/${max} for this niche already`,
      existing,
    };
  }
  return { ok: true, reason: null, existing };
}

/** Record that an account took an action now (updates lastActionAt). */
export async function markActionTaken(accountId: number, now: Date = new Date()): Promise<void> {
  await db.update(accounts).set({ lastActionAt: now }).where(eq(accounts.id, accountId));
}
