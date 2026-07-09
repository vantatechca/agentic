import type { Platform } from "@/config/app";

/**
 * SourceAdapter (spec §3 "free-scrape honesty note").
 *
 * Every monitoring source implements this interface. Scrapers are best-effort
 * enrichment, NEVER load-bearing: when one breaks, the circuit breaker opens
 * and the dashboard falls back to manual-refresh mode. Apify / residential-proxy
 * scrapers swap in behind the same interface with zero refactor.
 */
export type DetectedPost = {
  postId: string;
  url: string;
  title?: string;
  caption?: string;
  publishedAt?: string;
};

export type FetchResult =
  | { ok: true; posts: DetectedPost[] }
  | { ok: false; error: string; blocked?: boolean };

export interface SourceAdapter {
  readonly platform: Platform;
  readonly kind: "api" | "rss" | "scrape";
  /** Fetch latest posts for a target since lastSeenPostId (adapter may ignore). */
  fetchLatest(target: {
    handle: string;
    channelId?: string | null;
    lastSeenPostId?: string | null;
  }): Promise<FetchResult>;
}
