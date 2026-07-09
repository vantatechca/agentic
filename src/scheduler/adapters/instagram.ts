import { env } from "@/env";
import type { PostAdapter, PostInput, PostOutcome } from "./types";

/**
 * Instagram Graph API publish (spec §3: AUTO for business accounts).
 *
 * Real two-step flow:
 *   1. POST /{ig-user-id}/media       → creation_id (container)
 *   2. POST /{ig-user-id}/media_publish (creation_id) → published media id
 *
 * Requires a public image_url/video_url (link-based media store) and a token.
 * Token + ig user id come from the account's authTokens
 * ({ igUserId, accessToken }) or fall back to a global IG_GRAPH_API_TOKEN with
 * authTokens.igUserId.
 */
const GRAPH = "https://graph.facebook.com/v20.0";

export const instagramAdapter: PostAdapter = {
  platform: "instagram",
  mode: "auto",
  async publish(input: PostInput): Promise<PostOutcome> {
    const tokens = (input.authTokens ?? {}) as { igUserId?: string; accessToken?: string };
    const igUserId = tokens.igUserId;
    const accessToken = tokens.accessToken || env.IG_GRAPH_API_TOKEN;

    if (!igUserId || !accessToken) {
      return { status: "needs_human", reason: "missing IG user id or access token" };
    }
    if (!input.mediaRef) {
      return { status: "needs_human", reason: "no public media URL for IG publish" };
    }

    const caption = [input.caption, input.hashtags.join(" ")].filter(Boolean).join("\n\n");
    const isVideo = /\.(mp4|mov)(\?|$)/i.test(input.mediaRef);

    try {
      // 1) create container
      const containerParams = new URLSearchParams({
        access_token: accessToken,
        caption,
        ...(isVideo ? { media_type: "REELS", video_url: input.mediaRef } : { image_url: input.mediaRef }),
      });
      const createRes = await fetch(`${GRAPH}/${igUserId}/media`, {
        method: "POST",
        body: containerParams,
        signal: AbortSignal.timeout(30_000),
      });
      const createData = (await createRes.json()) as { id?: string; error?: { message?: string } };
      if (!createRes.ok || !createData.id) {
        return { status: "failed", error: `IG container: ${createData.error?.message ?? createRes.status}` };
      }

      // 2) publish container
      const publishParams = new URLSearchParams({ access_token: accessToken, creation_id: createData.id });
      const pubRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
        method: "POST",
        body: publishParams,
        signal: AbortSignal.timeout(30_000),
      });
      const pubData = (await pubRes.json()) as { id?: string; error?: { message?: string } };
      if (!pubRes.ok || !pubData.id) {
        // Video containers may need processing time; surface for retry/human.
        return { status: "needs_human", reason: `IG publish pending/failed: ${pubData.error?.message ?? pubRes.status}` };
      }
      return { status: "posted", url: `https://www.instagram.com/p/${pubData.id}/` };
    } catch (e) {
      return { status: "failed", error: (e as Error).message };
    }
  },
};
