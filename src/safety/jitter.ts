import { DEFAULTS } from "@/config/app";

/**
 * Timing jitter (spec §6.4). Alerts get a comment WINDOW ("9:12–9:38"), never
 * "now" for everyone. Windows are staggered across accounts on the same target
 * by offsetting each account's window start by an index-based base plus random
 * jitter, so no two fleet accounts fire at the same instant.
 *
 * NOTE: uses Math.random for jitter — acceptable here (non-cryptographic,
 * purely for staggering). Kept out of any code path that runs inside a workflow
 * script (those forbid Math.random for determinism); this is app runtime.
 */

export type CommentWindow = { start: Date; end: Date };

/**
 * Build a jittered comment window for the Nth account assigned to a target.
 * @param stagger index of this account among those assigned to the same target
 */
export function makeCommentWindow(now: Date = new Date(), stagger = 0): CommentWindow {
  const { min, max } = DEFAULTS.commentWindowMinutes;
  // Base delay grows with stagger so accounts don't overlap; plus random jitter.
  const baseOffsetMin = stagger * randInt(4, 9);
  const jitterMin = randInt(1, 6);
  const startOffsetMin = baseOffsetMin + jitterMin;
  const windowLenMin = randInt(min, max);

  const start = new Date(now.getTime() + startOffsetMin * 60_000);
  const end = new Date(start.getTime() + windowLenMin * 60_000);
  return { start, end };
}

/** Randomized per-account daily comment budget within the configured band. */
export function randomDailyCommentBudget(): number {
  const { min, max } = DEFAULTS.dailyCommentBudget;
  return randInt(min, max);
}

/** Human-readable window label like "9:12–9:38". */
export function formatWindow(w: CommentWindow): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${fmt(w.start)}–${fmt(w.end)}`;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
