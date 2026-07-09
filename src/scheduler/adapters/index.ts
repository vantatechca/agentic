import type { Platform } from "@/config/app";
import { capabilities } from "@/env";
import type { PostAdapter, PostInput, PostOutcome } from "./types";

/**
 * Platform posting adapters (P3). Each is a thin stub that becomes live when
 * its credentials are present; otherwise it returns needs_human so the post
 * falls back to the reminder flow (never silently drops).
 */

const youtubeAdapter: PostAdapter = {
  platform: "youtube",
  mode: "auto",
  async publish(input: PostInput): Promise<PostOutcome> {
    if (!capabilities.hasYouTube && !input.authTokens) {
      return { status: "needs_human", reason: "no YouTube API credentials" };
    }
    // TODO(P3): videos.insert via Data API upload using per-account OAuth token.
    return { status: "needs_human", reason: "YouTube upload not yet implemented (P3)" };
  },
};

const instagramAdapter: PostAdapter = {
  platform: "instagram",
  mode: "auto",
  async publish(input: PostInput): Promise<PostOutcome> {
    if (!input.authTokens) {
      return { status: "needs_human", reason: "no IG Graph API token for account" };
    }
    // TODO(P3): Graph API media container -> publish for business accounts.
    return { status: "needs_human", reason: "IG Graph publish not yet implemented (P3)" };
  },
};

const tiktokAdapter: PostAdapter = {
  platform: "tiktok",
  // Reminder-fallback ships in P3 regardless of API approval (spec §12).
  mode: "reminder",
  async publish(): Promise<PostOutcome> {
    return {
      status: "needs_human",
      reason: "TikTok Content Posting API pending approval — scheduled reminder for human post",
    };
  },
};

const ADAPTERS: Record<Platform, PostAdapter> = {
  youtube: youtubeAdapter,
  instagram: instagramAdapter,
  tiktok: tiktokAdapter,
};

export function getPostAdapter(platform: Platform): PostAdapter {
  return ADAPTERS[platform];
}
