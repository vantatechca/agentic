import { and, eq, gte, desc } from "drizzle-orm";
import { db } from "@/db";
import { captions } from "@/db/schema";
import type { HashtagBank } from "@/db/schema";

/**
 * Hashtag mixer (spec §8). Fills hashtag slots from the niche bank — NOT from
 * the LLM — to prevent invented/banned tags. Default mix 2 evergreen + 2
 * trending + 1 branded, and never the identical full set twice in 7 days per
 * account.
 *
 * Only trending tags that are approved and unexpired are eligible.
 */

export type MixSlots = { evergreen: number; trending: number; branded: number };
export const DEFAULT_SLOTS: MixSlots = { evergreen: 2, trending: 2, branded: 1 };

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function mixHashtags(args: {
  bank: HashtagBank;
  accountId?: number | null;
  slots?: MixSlots;
  now?: Date;
}): Promise<string[]> {
  const slots = args.slots ?? DEFAULT_SLOTS;
  const now = args.now ?? new Date();

  const eligibleTrending = args.bank.trending
    .filter((t) => t.approved)
    .filter((t) => !t.expiresAt || new Date(t.expiresAt) > now)
    .map((t) => t.tag);

  // Recent full-sets used by this account (to enforce no-identical-in-7-days)
  const recentSets = args.accountId
    ? await recentHashtagSets(args.accountId, now)
    : new Set<string>();

  // Try a handful of shuffles to find a set not used in the last 7 days.
  for (let attempt = 0; attempt < 8; attempt++) {
    const picked = [
      ...sample(args.bank.evergreen, slots.evergreen),
      ...sample(eligibleTrending, slots.trending),
      ...sample(args.bank.branded, slots.branded),
    ];
    const key = setKey(picked);
    if (!recentSets.has(key) || attempt === 7) {
      return dedupe(picked);
    }
  }
  return [];
}

async function recentHashtagSets(accountId: number, now: Date): Promise<Set<string>> {
  const since = new Date(now.getTime() - SEVEN_DAYS_MS);
  const rows = await db
    .select({ hashtags: captions.hashtags })
    .from(captions)
    .where(and(eq(captions.accountId, accountId), gte(captions.createdAt, since)))
    .orderBy(desc(captions.createdAt))
    .limit(50);
  return new Set(rows.map((r) => setKey(r.hashtags)));
}

function setKey(tags: string[]): string {
  return [...tags].map((t) => t.toLowerCase()).sort().join("|");
}

/** Random sample of n items without replacement. */
function sample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return [...arr];
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function dedupe(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}
