import type { SourceAdapter, FetchResult, DetectedPost } from "./types";

/**
 * YouTube new-upload adapter (spec §3: AUTO — RSS feeds, free, minutes-fast).
 *
 * Uses the public channel RSS feed (no API quota):
 *   https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
 *
 * Parsed with lightweight regex (feed is small, well-formed XML). This is the
 * load-bearing, reliable path — no key required.
 */
export const youtubeRssAdapter: SourceAdapter = {
  platform: "youtube",
  kind: "rss",
  async fetchLatest(target): Promise<FetchResult> {
    const channelId = target.channelId;
    if (!channelId) return { ok: false, error: "missing channelId for YouTube RSS" };
    try {
      const res = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
        { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "Mozilla/5.0" } },
      );
      if (!res.ok) return { ok: false, error: `RSS ${res.status}`, blocked: res.status === 429 };
      const xml = await res.text();
      return { ok: true, posts: parseFeed(xml) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};

function parseFeed(xml: string): DetectedPost[] {
  const entries = xml.split("<entry>").slice(1);
  const posts: DetectedPost[] = [];
  for (const entry of entries) {
    const videoId = match(entry, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    const title = match(entry, /<title>([^<]+)<\/title>/);
    const published = match(entry, /<published>([^<]+)<\/published>/);
    if (!videoId) continue;
    posts.push({
      postId: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: title ?? undefined,
      publishedAt: published ?? undefined,
    });
  }
  return posts;
}

function match(s: string, re: RegExp): string | null {
  const m = s.match(re);
  return m ? decodeXml(m[1]) : null;
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
