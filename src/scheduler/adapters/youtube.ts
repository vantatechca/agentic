import type { PostAdapter, PostInput, PostOutcome } from "./types";

/**
 * YouTube upload (spec §3: AUTO — Data API upload).
 *
 * Uses the resumable/multipart upload endpoint with the account's OAuth access
 * token (authTokens.accessToken). Fetches the media bytes from the public
 * mediaRef URL, then uploads with snippet metadata. Per-account OAuth spreads
 * quota (spec §12).
 *
 * Note: uploads consume ~1600 quota units each. Requires an OAuth token with
 * youtube.upload scope on the account.
 */
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status";

export const youtubeAdapter: PostAdapter = {
  platform: "youtube",
  mode: "auto",
  async publish(input: PostInput): Promise<PostOutcome> {
    const tokens = (input.authTokens ?? {}) as { accessToken?: string };
    const accessToken = tokens.accessToken;
    if (!accessToken) return { status: "needs_human", reason: "no YouTube OAuth access token for account" };
    if (!input.mediaRef) return { status: "needs_human", reason: "no media URL to upload" };

    try {
      // Fetch media bytes from the public URL.
      const media = await fetch(input.mediaRef, { signal: AbortSignal.timeout(120_000) });
      if (!media.ok) return { status: "failed", error: `fetch media ${media.status}` };
      const bytes = await media.arrayBuffer();

      const snippet = {
        snippet: {
          title: (input.caption?.split("\n")[0] || "New upload").slice(0, 100),
          description: [input.caption, input.hashtags.join(" ")].filter(Boolean).join("\n\n").slice(0, 4900),
          tags: input.hashtags.map((h) => h.replace(/^#/, "")).slice(0, 15),
        },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      };

      // Multipart related body: metadata (json) + media.
      const boundary = "agenticboundary";
      const enc = new TextEncoder();
      const head = enc.encode(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(snippet)}\r\n--${boundary}\r\nContent-Type: video/*\r\n\r\n`,
      );
      const tail = enc.encode(`\r\n--${boundary}--`);
      const body = new Uint8Array(head.length + bytes.byteLength + tail.length);
      body.set(head, 0);
      body.set(new Uint8Array(bytes), head.length);
      body.set(tail, head.length + bytes.byteLength);

      const res = await fetch(UPLOAD, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
        signal: AbortSignal.timeout(180_000),
      });
      const data = (await res.json()) as { id?: string; error?: { message?: string } };
      if (!res.ok || !data.id) {
        return { status: "failed", error: `YT upload: ${data.error?.message ?? res.status}` };
      }
      return { status: "posted", url: `https://www.youtube.com/watch?v=${data.id}` };
    } catch (e) {
      return { status: "failed", error: (e as Error).message };
    }
  },
};
