import { eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts, comments } from "@/db/schema";
import type { CommentVariant } from "@/db/schema";
import { scrub } from "@/safety/bannedWords";
import { checkSimilarity } from "@/safety/similarityGuard";
import { checkCommentBudget, checkOneCommentPerVideo, markActionTaken } from "@/safety/budgets";

/**
 * Record a chosen comment as posted (spec §9: paste-confirm records postedAt,
 * method=manual). Runs the FINAL safety gate against live DB state before
 * committing — budget, one-per-video, fleet similarity, banned words — so a
 * stale generated variant can't slip past guards that changed since generation.
 */
export async function recordComment(args: {
  alertId?: number | null;
  accountId: number;
  nicheKey: string;
  videoUrl: string;
  chosenText: string;
  tone?: string;
  method?: "api" | "manual";
  variants?: CommentVariant[];
  nicheBanned: string[];
}): Promise<{ ok: boolean; reason?: string; commentId?: number }> {
  const text = args.chosenText.trim();

  // 1) banned words
  const banned = scrub(text, args.nicheBanned);
  if (!banned.ok) return { ok: false, reason: banned.reason ?? "banned words" };

  // 2) budget + status + min-gap
  const budget = await checkCommentBudget(args.accountId);
  if (!budget.ok) return { ok: false, reason: budget.reason ?? "budget" };

  // 3) one-comment-per-video per niche
  const perVideo = await checkOneCommentPerVideo(args.videoUrl, args.nicheKey);
  if (!perVideo.ok) return { ok: false, reason: perVideo.reason ?? "one-per-video" };

  // 4) fleet similarity guard (DB-backed)
  const sim = await checkSimilarity(text, { accountId: args.accountId, videoUrl: args.videoUrl });
  if (!sim.ok) return { ok: false, reason: sim.reason ?? "similarity" };

  const now = new Date();
  const [inserted] = await db
    .insert(comments)
    .values({
      alertId: args.alertId ?? null,
      accountId: args.accountId,
      nicheKey: args.nicheKey,
      videoUrl: args.videoUrl,
      generatedVariants: args.variants ?? [],
      chosenText: text,
      tone: args.tone ?? null,
      method: args.method ?? "manual",
      postedAt: now,
      simHash: sim.hash,
    })
    .returning({ id: comments.id });

  await markActionTaken(args.accountId, now);

  if (args.alertId) {
    await db.update(alerts).set({ status: "commented" }).where(eq(alerts.id, args.alertId));
  }

  return { ok: true, commentId: inserted.id };
}
