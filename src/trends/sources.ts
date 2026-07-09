import { env, capabilities } from "@/env";

/**
 * Raw trend signal sources for Trend Radar (spec §3, §5). Each returns candidate
 * topics that the LLM later ranks per niche (§7.3). All are best-effort and
 * degrade to [] on failure — the digest still runs with whatever was gathered.
 */
export type RawSignal = { topic: string; platform: string; source: string; signal?: string };

/**
 * Google Trends daily trending searches via the public RSS proxy (no key).
 * Filtered to items whose title/snippet mentions any niche term so the digest
 * stays on-topic. This is the "Google Trends proxy" the spec calls for.
 */
export async function googleTrends(terms: string[], geo = "US"): Promise<RawSignal[]> {
  try {
    const res = await fetch(
      `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}`,
      { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "Mozilla/5.0" } },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const titles = [...xml.matchAll(/<title>([^<]+)<\/title>/g)].map((m) => decode(m[1]));
    const lowerTerms = terms.map((t) => t.toLowerCase());
    // Keep trends related to the niche; if no terms, keep the top few as-is.
    const relevant = titles
      .slice(1) // first <title> is the feed title
      .filter((t) => !lowerTerms.length || lowerTerms.some((term) => t.toLowerCase().includes(term)));
    const chosen = (relevant.length ? relevant : titles.slice(1, 6)).slice(0, 8);
    return chosen.map((topic) => ({ topic, platform: "youtube", source: "google-trends" }));
  } catch (e) {
    console.warn("[trends] googleTrends failed:", (e as Error).message);
    return [];
  }
}

/** YouTube Data API search by niche keywords (viewCount order). */
export async function youtubeSignals(terms: string[]): Promise<RawSignal[]> {
  if (!capabilities.hasYouTube || !terms.length) return [];
  try {
    const q = encodeURIComponent(terms.slice(0, 3).join(" "));
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=10&q=${q}&key=${env.YOUTUBE_API_KEY}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: { snippet?: { title?: string } }[] };
    return (data.items ?? [])
      .map((it) => it.snippet?.title)
      .filter((t): t is string => Boolean(t))
      .map((topic) => ({ topic, platform: "youtube", source: "yt-data-api" }));
  } catch (e) {
    console.warn("[trends] youtubeSignals failed:", (e as Error).message);
    return [];
  }
}

/**
 * TikTok Creative Center public trends. The public JSON endpoints are unstable
 * and region-gated; this is a placeholder that stays honest (returns []) until a
 * concrete endpoint/scraper is wired. Kept as a named source for parity.
 */
export async function tiktokCreativeCenter(): Promise<RawSignal[]> {
  // TODO(P2): scrape Creative Center public pages or use Apify actor.
  return [];
}

/** Gather all raw signals for a niche across sources. */
export async function gatherSignals(terms: string[]): Promise<RawSignal[]> {
  const [g, y, t] = await Promise.all([
    googleTrends(terms),
    youtubeSignals(terms),
    tiktokCreativeCenter(),
  ]);
  // De-dupe by lowercased topic.
  const seen = new Set<string>();
  const out: RawSignal[] = [];
  for (const s of [...y, ...g, ...t]) {
    const k = s.topic.toLowerCase().trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out.slice(0, 25);
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .trim();
}
