import { db } from "@/db";
import { trends } from "@/db/schema";
import { capabilities } from "@/env";
import { generateJson } from "@/ai/provider";
import { TREND_SYSTEM_PROMPT, buildTrendUserMessage } from "@/ai/prompts";
import type { NicheProfile } from "@/niches/registry";
import { gatherSignals } from "./sources";

/**
 * Trend Radar (spec §2 Module 2, §7.3 prompt, P2).
 *
 * scanNiche gathers raw trend signals (YT Data API mostPopular/search where a
 * key exists; extensible with Google-Trends/Creative-Center sources), then asks
 * the LLM to rank 5-8 niche opportunities and persists them for the digest.
 */

export type Opportunity = {
  topic: string;
  platform: string;
  whyNow: string;
  contentAngle: string;
  commentAngle: string;
  score: number;
};

export async function scanNiche(niche: NicheProfile, digestDate: string): Promise<Opportunity[]> {
  const raw = await gatherSignals(niche.terms);
  if (!capabilities.hasAnyAI) {
    console.warn("[trends] no AI provider — skipping ranking for", niche.key);
    return [];
  }

  const ranked = await generateJson<{ opportunities: Opportunity[] }>(
    [
      { role: "system", content: TREND_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildTrendUserMessage({
          nicheProfile: {
            key: niche.key,
            name: niche.name,
            voice: niche.voice,
            terms: niche.terms,
          },
          rawTrends: raw,
        }),
      },
    ],
    { temperature: 0.5, maxTokens: 1500 },
  );

  const opportunities = (ranked.opportunities ?? []).slice(0, 8);

  if (opportunities.length) {
    await db.insert(trends).values(
      opportunities.map((o) => ({
        nicheKey: niche.key,
        platform: (["youtube", "instagram", "tiktok"].includes(o.platform)
          ? o.platform
          : "youtube") as "youtube" | "instagram" | "tiktok",
        topic: o.topic,
        source: "llm-ranked",
        whyNow: o.whyNow,
        contentAngle: o.contentAngle,
        commentAngle: o.commentAngle,
        score: clampScore(o.score),
        digestDate,
      })),
    );
  }

  return opportunities;
}

function clampScore(n: number): number {
  return Math.max(1, Math.min(10, Number(n) || 1));
}
