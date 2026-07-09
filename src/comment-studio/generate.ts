import { and, eq, gte, desc } from "drizzle-orm";
import { db } from "@/db";
import { comments } from "@/db/schema";
import type { CommentVariant } from "@/db/schema";
import { generateJson } from "@/ai/provider";
import { COMMENT_SYSTEM_PROMPT, buildCommentUserMessage } from "@/ai/prompts";
import type { NicheProfile } from "@/niches/registry";
import { scrub } from "@/safety/bannedWords";
import { simhash, similarity, SIMILARITY_THRESHOLD } from "@/safety/simhash";
import { checkOneCommentPerVideo } from "@/safety/budgets";

/**
 * Comment Studio (spec §4 Module, §7.1 prompt).
 *
 * Flow:
 *   1. Ask the LLM for 5 ranked variants.
 *   2. Scrub each variant against banned words (global + niche) + structural spam.
 *   3. Compute simhash; flag near-duplicates vs recent fleet comments in-process.
 *   4. Return variants annotated with blocked/blockReason + simHash, plus a
 *      one-comment-per-video verdict for the caller to enforce.
 *
 * The DB write of the chosen comment happens later (agent marks done / API
 * posts) — this function is generation + pre-display safety only.
 */

export type GenerateResult = {
  variants: CommentVariant[];
  safeVariants: CommentVariant[];
  oneCommentPerVideo: { ok: boolean; reason: string | null; existing: number };
};

export async function generateComments(args: {
  platform: string;
  niche: NicheProfile;
  videoUrl: string;
  captionOrTitle: string;
  transcriptSnippet?: string;
  tonePreference?: string;
}): Promise<GenerateResult> {
  const recentFleet = await recentFleetCommentTexts(args.niche.key);

  const raw = await generateJson<{ variants: CommentVariant[] }>(
    [
      { role: "system", content: COMMENT_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildCommentUserMessage({
          platform: args.platform,
          nicheProfile: {
            key: args.niche.key,
            voice: args.niche.voice,
            safeCommentPatterns: args.niche.safeCommentPatterns,
            commentTones: args.niche.commentTones,
          },
          captionOrTitle: args.captionOrTitle,
          transcriptSnippet: args.transcriptSnippet,
          tonePreference: args.tonePreference,
          recentFleetComments: recentFleet.texts,
          bannedWords: args.niche.bannedWords,
        }),
      },
    ],
    { temperature: 0.9, maxTokens: 1200 },
  );

  const variants: CommentVariant[] = (raw.variants ?? []).map((v) => {
    const text = (v.text ?? "").trim();
    const banned = scrub(text, args.niche.bannedWords);
    const hash = simhash(text);

    // near-dup vs recent fleet simhashes (in addition to the DB guard at post time)
    let simBlock: string | null = null;
    let closest = 0;
    for (const h of recentFleet.hashes) {
      const s = similarity(hash, h);
      if (s > closest) closest = s;
      if (s > SIMILARITY_THRESHOLD) {
        simBlock = `near-duplicate of a recent fleet comment (sim=${s.toFixed(2)})`;
        break;
      }
    }

    const blockReason = !banned.ok ? banned.reason : simBlock;
    return {
      text,
      tone: v.tone ?? "",
      lengthBand: v.lengthBand === "medium" ? "medium" : "short",
      riskNote: v.riskNote ?? null,
      simHash: hash,
      blocked: Boolean(blockReason),
      blockReason,
    };
  });

  const safeVariants = variants.filter((v) => !v.blocked);

  const oneCommentPerVideo = await checkOneCommentPerVideo(args.videoUrl, args.niche.key);

  return { variants, safeVariants, oneCommentPerVideo };
}

async function recentFleetCommentTexts(
  nicheKey: string,
): Promise<{ texts: string[]; hashes: string[] }> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const rows = await db
    .select({ chosenText: comments.chosenText, simHash: comments.simHash })
    .from(comments)
    .where(and(eq(comments.nicheKey, nicheKey), gte(comments.createdAt, since)))
    .orderBy(desc(comments.createdAt))
    .limit(20);
  return {
    texts: rows.map((r) => r.chosenText).filter((t): t is string => Boolean(t)),
    hashes: rows.map((r) => r.simHash).filter((h): h is string => Boolean(h)),
  };
}
