/**
 * YouTube API auto-commenting (spec §3, §11 P4 opt-in per account).
 *
 * Posts a top-level comment via Data API commentThreads.insert using the
 * account's OAuth access token (authTokens.accessToken with the
 * youtube.force-ssl scope). Per-account OAuth spreads quota (spec §12).
 * Returns the created comment id (for later metric re-polling) or an error.
 */
export type AutoCommentResult =
  | { ok: true; commentId: string }
  | { ok: false; reason: string };

export async function postYouTubeComment(args: {
  accessToken: string;
  videoId: string;
  text: string;
}): Promise<AutoCommentResult> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            videoId: args.videoId,
            topLevelComment: { snippet: { textOriginal: args.text } },
          },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    const data = (await res.json()) as {
      id?: string;
      snippet?: { topLevelComment?: { id?: string } };
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, reason: `YT comment: ${data.error?.message ?? res.status}` };
    const commentId = data.snippet?.topLevelComment?.id ?? data.id;
    if (!commentId) return { ok: false, reason: "no comment id returned" };
    return { ok: true, commentId };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
