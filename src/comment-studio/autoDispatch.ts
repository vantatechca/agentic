import { eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts, accounts, comments } from "@/db/schema";
import { getNiche } from "@/niches/registry";
import { ensureNicheProfile } from "@/niches/ensureNicheProfile";
import { generateComments } from "./generate";
import { scrub } from "@/safety/bannedWords";
import { checkSimilarity } from "@/safety/similarityGuard";
import { checkCommentBudget, checkOneCommentPerVideo, markActionTaken } from "@/safety/budgets";
import { postYouTubeComment } from "./autoComment";
import { ytVideoId } from "@/analytics/metrics";

/**
 * Auto-comment dispatch (P4 opt-in). Fired by the pg-boss comment-dispatch worker
 * at the alert's comment-window start for YouTube accounts with ytAutoComment.
 *
 * Runs the SAME safety gate as the manual record path (budget, one-per-video,
 * fleet similarity, banned words), generates the top natural variant, posts it
 * via the YT API, and records the comment with method=api + platformCommentId
 * (so the engagement sweep can re-poll it). Any gate failure aborts silently
 * (logged) — the alert simply isn't auto-commented.
 */
export async function dispatchAutoComment(
  alertId: number,
  accountId: number,
): Promise<{ ok: boolean; reason?: string; commentId?: number }> {
  const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId)).limit(1);
  if (!alert) return { ok: false, reason: "alert not found" };
  if (alert.status === "commented") return { ok: false, reason: "already commented" };

  const [acct] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!acct) return { ok: false, reason: "account not found" };
  if (acct.platform !== "youtube" || !acct.ytAutoComment) {
    return { ok: false, reason: "account not opted into YT auto-comment" };
  }
  const accessToken = (acct.authTokens as { accessToken?: string } | null)?.accessToken;
  if (!accessToken) return { ok: false, reason: "no YT OAuth token on account" };

  const videoId = ytVideoId(alert.postUrl);
  if (!videoId) return { ok: false, reason: "could not parse video id" };

  // Pre-gate: budget + one-per-video
  const budget = await checkCommentBudget(accountId);
  if (!budget.ok) return { ok: false, reason: budget.reason ?? "budget" };
  const perVideo = await checkOneCommentPerVideo(alert.postUrl, alert.nicheKey);
  if (!perVideo.ok) return { ok: false, reason: perVideo.reason ?? "one-per-video" };

  const niche = (await getNiche(alert.nicheKey)) ?? (await ensureNicheProfile(alert.nicheKey));

  const gen = await generateComments({
    platform: "youtube",
    niche,
    videoUrl: alert.postUrl,
    captionOrTitle: alert.title || alert.caption || alert.postUrl,
  });

  // Pick the top variant that passes banned + fleet-similarity gates.
  for (const v of gen.safeVariants) {
    if (!scrub(v.text, niche.bannedWords).ok) continue;
    const sim = await checkSimilarity(v.text, { accountId, videoUrl: alert.postUrl });
    if (!sim.ok) continue;

    const posted = await postYouTubeComment({ accessToken, videoId, text: v.text });
    if (!posted.ok) return { ok: false, reason: posted.reason };

    const now = new Date();
    const [row] = await db
      .insert(comments)
      .values({
        alertId: alert.id,
        accountId,
        nicheKey: alert.nicheKey,
        videoUrl: alert.postUrl,
        generatedVariants: gen.variants,
        chosenText: v.text,
        tone: v.tone,
        method: "api",
        platformCommentId: posted.commentId,
        postedAt: now,
        simHash: sim.hash,
      })
      .returning({ id: comments.id });

    await markActionTaken(accountId, now);
    await db.update(alerts).set({ status: "commented" }).where(eq(alerts.id, alert.id));
    return { ok: true, commentId: row.id };
  }

  return { ok: false, reason: "no variant passed the safety gate" };
}
