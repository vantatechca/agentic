import type { Platform } from "@/config/app";

/**
 * PostAdapter — own-content posting interface (spec §3, §6 Scheduler).
 * YT + IG auto via API, TikTok reminder-fallback until API approval lands.
 * Same adapter-interface discipline as SourceAdapter so a platform can move
 * from "reminder" to "auto" without touching the scheduler.
 */
export type PostInput = {
  accountId: number;
  platform: Platform;
  mediaRef: string | null;
  caption: string | null;
  hashtags: string[];
  authTokens?: Record<string, unknown> | null;
};

export type PostOutcome =
  | { status: "posted"; url: string }
  | { status: "needs_human"; reason: string }
  | { status: "failed"; error: string };

export interface PostAdapter {
  readonly platform: Platform;
  readonly mode: "auto" | "reminder";
  publish(input: PostInput): Promise<PostOutcome>;
}
