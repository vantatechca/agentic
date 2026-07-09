import { eq } from "drizzle-orm";
import { db } from "@/db";
import { niches } from "@/db/schema";
import type { HashtagBank } from "@/db/schema";

/**
 * Trending hashtag tier management (spec §8). Trend Radar proposes trending tags
 * (unapproved, with an expiry); an admin approves them before they enter the
 * mixer rotation. The mixer only draws approved + unexpired tags.
 */

const DEFAULT_TTL_DAYS = 7;

/** Propose candidate trending tags for a niche (unapproved). Idempotent by tag. */
export async function proposeTrendingTags(
  nicheKey: string,
  tags: string[],
  ttlDays = DEFAULT_TTL_DAYS,
  now: Date = new Date(),
): Promise<number> {
  const [n] = await db.select().from(niches).where(eq(niches.key, nicheKey)).limit(1);
  if (!n) return 0;
  const bank = n.hashtagBank;
  const existing = new Set(bank.trending.map((t) => t.tag.toLowerCase()));
  const expiresAt = new Date(now.getTime() + ttlDays * 86_400_000).toISOString();

  let added = 0;
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (!tag || existing.has(tag.toLowerCase())) continue;
    bank.trending.push({ tag, expiresAt, approved: false });
    existing.add(tag.toLowerCase());
    added++;
  }
  if (added) await save(n.id, bank);
  return added;
}

/** Approve (or reject) a proposed trending tag for rotation. */
export async function setTrendingApproval(
  nicheKey: string,
  tag: string,
  approved: boolean,
): Promise<boolean> {
  const [n] = await db.select().from(niches).where(eq(niches.key, nicheKey)).limit(1);
  if (!n) return false;
  const bank = n.hashtagBank;
  const norm = normalizeTag(tag).toLowerCase();
  const entry = bank.trending.find((t) => t.tag.toLowerCase() === norm);
  if (!entry) return false;
  entry.approved = approved;
  await save(n.id, bank);
  return true;
}

/** Remove expired trending tags (called by the weekly Inngest expiry job). */
export async function pruneExpired(nicheKey: string, now: Date = new Date()): Promise<number> {
  const [n] = await db.select().from(niches).where(eq(niches.key, nicheKey)).limit(1);
  if (!n) return 0;
  const bank = n.hashtagBank;
  const iso = now.toISOString();
  const before = bank.trending.length;
  bank.trending = bank.trending.filter((t) => !t.expiresAt || t.expiresAt > iso);
  const removed = before - bank.trending.length;
  if (removed) await save(n.id, bank);
  return removed;
}

function normalizeTag(t: string): string {
  const cleaned = t.trim().replace(/\s+/g, "").replace(/[^#\w]/g, "");
  if (!cleaned) return "";
  return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
}

async function save(id: number, bank: HashtagBank): Promise<void> {
  await db.update(niches).set({ hashtagBank: bank, updatedAt: new Date() }).where(eq(niches.id, id));
}
