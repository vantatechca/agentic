import type { Platform } from "@/config/app";
import { env } from "@/env";
import type { SourceAdapter, FetchResult, DetectedPost } from "./types";

/**
 * Apify-backed IG/TikTok scrape adapter (spec §3, §12 mitigation: "Apify swap-in
 * later"). Same SourceAdapter interface as the free-scrape stub — swapping is a
 * config change (APIFY_TOKEN present), no caller refactor.
 *
 * Uses Apify's run-sync-get-dataset-items endpoint so we get results in one
 * call. Actor ids are the well-known community actors; override per deployment
 * via APIFY_IG_ACTOR / APIFY_TIKTOK_ACTOR if desired.
 */

const ACTORS: Record<Platform, string> = {
  instagram: process.env.APIFY_IG_ACTOR || "apify~instagram-profile-scraper",
  tiktok: process.env.APIFY_TIKTOK_ACTOR || "clockworks~tiktok-profile-scraper",
  youtube: "", // not used — YT uses RSS
};

function makeApifyAdapter(platform: Platform): SourceAdapter {
  return {
    platform,
    kind: "scrape",
    async fetchLatest(target): Promise<FetchResult> {
      const actor = ACTORS[platform];
      if (!actor) return { ok: false, error: `no Apify actor for ${platform}` };
      try {
        const res = await fetch(
          `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${env.APIFY_TOKEN}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildInput(platform, target.handle)),
            signal: AbortSignal.timeout(60_000),
          },
        );
        if (!res.ok) {
          // 429 / 402 => treat as blocked so the circuit breaker engages.
          const blocked = res.status === 429 || res.status === 402;
          return { ok: false, error: `Apify ${res.status}`, blocked };
        }
        const items = (await res.json()) as unknown[];
        return { ok: true, posts: mapItems(platform, items) };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  };
}

function buildInput(platform: Platform, handle: string): Record<string, unknown> {
  const clean = handle.replace(/^@/, "");
  if (platform === "instagram") {
    return { usernames: [clean], resultsLimit: 5 };
  }
  // tiktok
  return { profiles: [clean], resultsPerPage: 5, shouldDownloadVideos: false };
}

function mapItems(platform: Platform, items: unknown[]): DetectedPost[] {
  const posts: DetectedPost[] = [];
  for (const raw of items.slice(0, 10)) {
    const it = raw as Record<string, any>;
    if (platform === "instagram") {
      const id = it.id || it.shortCode || it.shortcode;
      if (!id) continue;
      posts.push({
        postId: String(id),
        url: it.url || `https://www.instagram.com/p/${it.shortCode ?? id}/`,
        caption: it.caption ?? undefined,
        publishedAt: it.timestamp ?? undefined,
      });
    } else {
      const id = it.id || it.videoId;
      if (!id) continue;
      posts.push({
        postId: String(id),
        url: it.webVideoUrl || it.url || `https://www.tiktok.com/video/${id}`,
        caption: it.text ?? it.desc ?? undefined,
        publishedAt: it.createTimeISO ?? undefined,
      });
    }
  }
  return posts;
}

export const instagramApifyAdapter = makeApifyAdapter("instagram");
export const tiktokApifyAdapter = makeApifyAdapter("tiktok");
