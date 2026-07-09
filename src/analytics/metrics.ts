import { env, capabilities } from "@/env";

/**
 * Live metric fetchers (spec §5 engagement sweep, P4). Each returns null when
 * unreachable/unconfigured so the sweep degrades gracefully.
 */

export type CommentMetrics = { likes: number; replies: number; missing?: boolean };

/** YouTube comment stats via Data API comments.list (needs an API key). */
export async function fetchYouTubeCommentMetrics(commentId: string): Promise<CommentMetrics | null> {
  if (!capabilities.hasYouTube) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/comments?part=snippet&id=${encodeURIComponent(commentId)}&key=${env.YOUTUBE_API_KEY}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: { snippet?: { likeCount?: number; totalReplyCount?: number } }[];
    };
    if (!data.items || data.items.length === 0) {
      // Comment no longer returned → likely removed.
      return { likes: 0, replies: 0, missing: true };
    }
    const sn = data.items[0].snippet;
    return { likes: sn?.likeCount ?? 0, replies: sn?.totalReplyCount ?? 0 };
  } catch {
    return null;
  }
}

/** YouTube video stats (own-post analytics). */
export async function fetchYouTubeVideoMetrics(
  videoId: string,
): Promise<{ views: number; likes: number; comments: number } | null> {
  if (!capabilities.hasYouTube) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(videoId)}&key=${env.YOUTUBE_API_KEY}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: { statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[];
    };
    const s = data.items?.[0]?.statistics;
    if (!s) return null;
    return {
      views: Number(s.viewCount ?? 0),
      likes: Number(s.likeCount ?? 0),
      comments: Number(s.commentCount ?? 0),
    };
  } catch {
    return null;
  }
}

/** Instagram media insights for own posts (Graph API). */
export async function fetchInstagramMediaMetrics(
  mediaId: string,
  accessToken: string,
): Promise<{ likes: number; comments: number; reach: number } | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${mediaId}?fields=like_count,comments_count&access_token=${accessToken}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { like_count?: number; comments_count?: number };
    return { likes: data.like_count ?? 0, comments: data.comments_count ?? 0, reach: 0 };
  } catch {
    return null;
  }
}

/** Extract a YouTube video id from a watch URL. */
export function ytVideoId(url: string): string | null {
  return url.match(/[?&]v=([\w-]{11})/)?.[1] ?? url.match(/youtu\.be\/([\w-]{11})/)?.[1] ?? null;
}
