import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, accountHealthEvents } from "@/db/schema";
import { DEFAULTS } from "@/config/app";
import { notifyFleetHealth } from "@/discord/notify";

/**
 * Health score (spec §6.5). Signals drop the score; crossing thresholds moves
 * the account to cooldown, then to paused (with a Discord alert). Score can
 * recover over time via the hourly recalc (see inngest health function).
 */

export type HealthSignal =
  | "comment_removed" // comment removed shortly after posting
  | "engagement_zero" // engagement suddenly zero
  | "comment_missing" // scrape shows comment missing
  | "recover"; // periodic positive drift

const SIGNAL_DELTAS: Record<HealthSignal, number> = {
  comment_removed: -20,
  engagement_zero: -8,
  comment_missing: -15,
  recover: +5,
};

export async function applyHealthSignal(
  accountId: number,
  signal: HealthSignal,
  note?: string,
): Promise<{ scoreAfter: number; status: string }> {
  const [acct] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!acct) throw new Error(`account ${accountId} not found`);

  const delta = SIGNAL_DELTAS[signal];
  const scoreAfter = clamp(acct.healthScore + delta, 0, DEFAULTS.health.start);

  // Determine status transition
  let status = acct.status;
  let transitioned: string | null = null;
  if (scoreAfter <= DEFAULTS.health.pauseBelow && acct.status !== "paused") {
    status = "paused";
    transitioned = "paused";
  } else if (
    scoreAfter <= DEFAULTS.health.cooldownBelow &&
    acct.status === "active"
  ) {
    status = "cooldown";
    transitioned = "cooldown";
  } else if (
    signal === "recover" &&
    scoreAfter > DEFAULTS.health.cooldownBelow &&
    acct.status === "cooldown"
  ) {
    // Recovered out of cooldown
    status = "active";
    transitioned = "reactivated";
  }

  await db
    .update(accounts)
    .set({ healthScore: scoreAfter, status, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

  await db.insert(accountHealthEvents).values({
    accountId,
    signal,
    delta,
    scoreAfter,
    note: note ?? null,
  });

  if (transitioned && transitioned !== "reactivated") {
    await notifyFleetHealth(
      `⚠️ Account **${acct.handle}** (${acct.platform}/${acct.nicheKey}) → **${transitioned}** ` +
        `(health ${scoreAfter}, signal: ${signal}${note ? `, ${note}` : ""})`,
    ).catch((e) => console.warn("[health] discord notify failed:", (e as Error).message));
  }

  return { scoreAfter, status };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
