import type { Platform } from "@/config/app";
import { capabilities } from "@/env";
import type { SourceAdapter, FetchResult } from "./types";

/**
 * IG / TikTok best-effort scrape adapters (spec §3, P2).
 *
 * v1 is free/scrape-only and explicitly best-effort. From a datacenter IP these
 * get blocked fast — so the default stub returns `blocked` to trip the circuit
 * breaker and drop the target into manual-refresh mode. When APIFY_TOKEN is
 * present, this is where an Apify actor call plugs in (same interface).
 */
function makeScrapeAdapter(platform: Platform): SourceAdapter {
  return {
    platform,
    kind: "scrape",
    async fetchLatest(): Promise<FetchResult> {
      if (capabilities.hasApify) {
        // TODO(P2): call Apify actor for this platform/profile and map results.
        return { ok: false, error: `Apify adapter for ${platform} not yet wired (P2)` };
      }
      // No paid scraper configured: honestly report blocked so the circuit
      // breaker opens and the dashboard shows manual-refresh for this target.
      return {
        ok: false,
        error: `free ${platform} scrape unavailable from datacenter IP`,
        blocked: true,
      };
    },
  };
}

export const instagramScrapeAdapter = makeScrapeAdapter("instagram");
export const tiktokScrapeAdapter = makeScrapeAdapter("tiktok");
