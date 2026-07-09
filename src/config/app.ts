/**
 * Product branding + global constants.
 *
 * The app name is a placeholder per the v1 spec (Open item #1) and is
 * deliberately isolated here so rebranding is a one-line change. Everything
 * user-facing should read from APP_NAME rather than hardcoding a string.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Agentic";

export const APP_TAGLINE = "SMM AI engagement platform";

/** Supported social platforms across the fleet. */
export const PLATFORMS = ["youtube", "instagram", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Default per-account daily action budgets (randomized per account per day). */
export const DEFAULTS = {
  dailyCommentBudget: { min: 8, max: 15 },
  dailyPostBudget: 3,
  /** Minimum gap between actions on the same account, milliseconds. */
  minActionGapMs: 12 * 60 * 1000,
  /** Comment window jitter span, minutes. */
  commentWindowMinutes: { min: 10, max: 30 },
  /** Health score thresholds (0-100). */
  health: { cooldownBelow: 60, pauseBelow: 35, start: 100 },
} as const;
