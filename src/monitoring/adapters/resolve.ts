import type { Platform } from "@/config/app";
import { capabilities } from "@/env";
import type { SourceAdapter } from "./types";
import { youtubeRssAdapter } from "./youtubeRss";
import { instagramScrapeAdapter, tiktokScrapeAdapter } from "./scrapeStub";
import { instagramApifyAdapter, tiktokApifyAdapter } from "./apify";

/**
 * Resolve the active SourceAdapter for a platform. IG/TikTok use the Apify
 * adapter when APIFY_TOKEN is set (best-effort enrichment), otherwise the free
 * stub that honestly reports "blocked" and lets the circuit breaker drop the
 * target to manual-refresh mode. YouTube always uses RSS (load-bearing).
 */
export function resolveAdapter(platform: Platform): SourceAdapter {
  switch (platform) {
    case "youtube":
      return youtubeRssAdapter;
    case "instagram":
      return capabilities.hasApify ? instagramApifyAdapter : instagramScrapeAdapter;
    case "tiktok":
      return capabilities.hasApify ? tiktokApifyAdapter : tiktokScrapeAdapter;
  }
}
