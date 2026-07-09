import { env, capabilities } from "@/env";

/**
 * YouTube Data API helpers (spec §3: AUTO monitoring). RSS is the load-bearing
 * poll path (no quota); the Data API is used only for one-off enrichment that
 * RSS can't provide — resolving a @handle to a channelId when adding a target,
 * and fetching a video description/stats. Both no-op cleanly without a key.
 */

const API = "https://www.googleapis.com/youtube/v3";

/** Resolve a channel handle (e.g. "@mkbhd") or custom URL to a channelId. */
export async function resolveChannelId(handleOrUrl: string): Promise<string | null> {
  if (!capabilities.hasYouTube) return null;

  // Already a channel id?
  const idMatch = handleOrUrl.match(/(UC[\w-]{22})/);
  if (idMatch) return idMatch[1];

  const handle = handleOrUrl
    .replace(/^https?:\/\/(www\.)?youtube\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "");

  try {
    // forHandle is supported by the channels endpoint.
    const res = await fetch(
      `${API}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${env.YOUTUBE_API_KEY}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (res.ok) {
      const data = (await res.json()) as { items?: { id?: string }[] };
      const id = data.items?.[0]?.id;
      if (id) return id;
    }
    // Fallback: search endpoint.
    const search = await fetch(
      `${API}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(handle)}&key=${env.YOUTUBE_API_KEY}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (search.ok) {
      const data = (await search.json()) as {
        items?: { snippet?: { channelId?: string } }[];
      };
      return data.items?.[0]?.snippet?.channelId ?? null;
    }
  } catch (e) {
    console.warn("[yt] resolveChannelId failed:", (e as Error).message);
  }
  return null;
}

/** Enrich a video id with description + basic stats (used post-RSS-detection). */
export async function enrichVideo(
  videoId: string,
): Promise<{ description?: string; title?: string } | null> {
  if (!capabilities.hasYouTube) return null;
  try {
    const res = await fetch(
      `${API}/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${env.YOUTUBE_API_KEY}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: { snippet?: { title?: string; description?: string } }[];
    };
    const sn = data.items?.[0]?.snippet;
    if (!sn) return null;
    return { title: sn.title, description: sn.description?.slice(0, 500) };
  } catch {
    return null;
  }
}
