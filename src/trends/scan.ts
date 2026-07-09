import { db } from "@/db";
import { trends } from "@/db/schema";
import { env, capabilities } from "@/env";
import { generateJson } from "@/ai/provider";
import { TREND_SYSTEM_PROMPT, buildTrendUserMessage } from "@/ai/prompts";
import type { NicheProfile } from "@/niches/registry";

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
  const raw = await gatherRawSignals(niche);
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

/** Gather raw candidate topics. YT Data API when available, else empty (P2 extends). */
async function gatherRawSignals(
  niche: NicheProfile,
): Promise<{ topic: string; platform: string; source: string; signal?: string }[]> {
  const signals: { topic: string; platform: string; source: string; signal?: string }[] = [];

  if (capabilities.hasYouTube && niche.terms.length) {
    try {
      const q = encodeURIComponent(niche.terms.slice(0, 3).join(" "));
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=10&q=${q}&key=${env.YOUTUBE_API_KEY}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          items?: { snippet?: { title?: string } }[];
        };
        for (const it of data.items ?? []) {
          if (it.snippet?.title) {
            signals.push({ topic: it.snippet.title, platform: "youtube", source: "yt-data-api" });
          }
        }
      }
    } catch (e) {
      console.warn("[trends] YT search failed:", (e as Error).message);
    }
  }

  // TODO(P2): Google Trends proxy, TikTok Creative Center public pages, IG hashtag pages.
  return signals;
}

function clampScore(n: number): number {
  return Math.max(1, Math.min(10, Number(n) || 1));
}
