import { and, eq, gte, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { comments } from "@/db/schema";
import { simhash, similarity, SIMILARITY_THRESHOLD } from "./simhash";

/**
 * Fleet-wide similarity guard (spec §6.1).
 *
 * Blocks a candidate comment if its simhash is too similar to:
 *   (a) any fleet comment on the SAME video,
 *   (b) the same account's last 50 comments,
 *   (c) any fleet comment in the last 48h.
 *
 * We fetch the relevant simhash sets once and compare in-process (Hamming on
 * 64-bit fingerprints is cheap; the candidate pools are bounded).
 */

export type SimilarityCheck = {
  ok: boolean;
  hash: string;
  closest: number; // highest similarity found (0..1)
  reason: string | null;
};

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export async function checkSimilarity(
  text: string,
  opts: { accountId: number; videoUrl: string; threshold?: number; now?: Date },
): Promise<SimilarityCheck> {
  const threshold = opts.threshold ?? SIMILARITY_THRESHOLD;
  const now = opts.now ?? new Date();
  const hash = simhash(text);

  const since = new Date(now.getTime() - FORTY_EIGHT_HOURS_MS);

  // (a) same video — any fleet account
  const sameVideo = await db
    .select({ simHash: comments.simHash })
    .from(comments)
    .where(and(eq(comments.videoUrl, opts.videoUrl), notNullSim()));

  // (b) same account last 50
  const accountRecent = await db
    .select({ simHash: comments.simHash })
    .from(comments)
    .where(and(eq(comments.accountId, opts.accountId), notNullSim()))
    .orderBy(desc(comments.createdAt))
    .limit(50);

  // (c) fleet last 48h
  const fleetRecent = await db
    .select({ simHash: comments.simHash })
    .from(comments)
    .where(and(gte(comments.createdAt, since), notNullSim()))
    .limit(2000);

  const pools: { label: string; hashes: string[] }[] = [
    { label: "same-video", hashes: pluck(sameVideo) },
    { label: "account-recent", hashes: pluck(accountRecent) },
    { label: "fleet-48h", hashes: pluck(fleetRecent) },
  ];

  let closest = 0;
  let reason: string | null = null;
  for (const pool of pools) {
    for (const h of pool.hashes) {
      const sim = similarity(hash, h);
      if (sim > closest) closest = sim;
      if (sim > threshold) {
        reason = `too similar to a ${pool.label} comment (sim=${sim.toFixed(2)} > ${threshold})`;
        return { ok: false, hash, closest, reason };
      }
    }
  }

  return { ok: true, hash, closest, reason };
}

function notNullSim() {
  return sql`${comments.simHash} is not null`;
}

function pluck(rows: { simHash: string | null }[]): string[] {
  return rows.map((r) => r.simHash).filter((h): h is string => Boolean(h));
}
