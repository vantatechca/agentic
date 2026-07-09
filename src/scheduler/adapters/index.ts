import type { Platform } from "@/config/app";
import type { PostAdapter, PostOutcome } from "./types";
import { instagramAdapter } from "./instagram";
import { youtubeAdapter } from "./youtube";

/**
 * Platform posting adapters (P3). YT + IG are real API implementations that
 * activate when the account carries the right auth tokens; otherwise they return
 * needs_human so the post falls back to the reminder flow (never silently drops).
 * TikTok is reminder-only until Content Posting API approval lands (spec §12).
 */

const tiktokAdapter: PostAdapter = {
  platform: "tiktok",
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
