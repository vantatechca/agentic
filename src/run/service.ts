import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { runSheets, clients, actionLog } from "@/db/schema";
import type { RunBlock } from "@/db/schema";
import { DEFAULT_RUN_BLOCKS, defaultQuotas, todayStr } from "@/config/operators";

export type RunSheetView = {
  id: number;
  clientId: number;
  date: string;
  quotas: Record<string, number>;
  blocks: RunBlock[];
  counts: Record<string, number>; // outbound comments logged today, per platform
};

/**
 * Get (or lazily create) a client's run sheet for a date. On first access it's
 * materialized from the client's enabled platforms + the default block template
 * (spec: operator run-sheet). Quota *targets* live on the sheet; current
 * *counts* are always derived from the action log so they can't drift.
 */
export async function getOrCreateRunSheet(clientId: number, date = todayStr()): Promise<RunSheetView | null> {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return null;

  let [sheet] = await db
    .select()
    .from(runSheets)
    .where(and(eq(runSheets.clientId, clientId), eq(runSheets.date, date)))
    .limit(1);

  if (!sheet) {
    const inserted = await db
      .insert(runSheets)
      .values({
        clientId,
        date,
        quotas: defaultQuotas(client.platforms),
        blocks: DEFAULT_RUN_BLOCKS,
      })
      .onConflictDoNothing({ target: [runSheets.clientId, runSheets.date] })
      .returning();
    sheet =
      inserted[0] ??
      (
        await db
          .select()
          .from(runSheets)
          .where(and(eq(runSheets.clientId, clientId), eq(runSheets.date, date)))
          .limit(1)
      )[0];
  }

  const counts = await quotaCounts(clientId, date);
  return {
    id: sheet.id,
    clientId,
    date,
    quotas: sheet.quotas,
    blocks: sheet.blocks,
    counts,
  };
}

/** Outbound-comment counts per platform for a client on a date (from the log). */
export async function quotaCounts(clientId: number, date: string): Promise<Record<string, number>> {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const rows = await db
    .select({ platform: actionLog.platform, count: sql<number>`count(*)::int` })
    .from(actionLog)
    .where(
      and(
        eq(actionLog.clientId, clientId),
        eq(actionLog.actionType, "comment"),
        eq(actionLog.countsToQuota, true),
        gte(actionLog.createdAt, dayStart),
        lte(actionLog.createdAt, dayEnd),
      ),
    )
    .groupBy(actionLog.platform);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.platform] = Number(r.count) || 0;
  return out;
}

/** Admin edit: replace quota targets and/or blocks. */
export async function updateRunSheet(
  id: number,
  patch: { quotas?: Record<string, number>; blocks?: RunBlock[] },
): Promise<boolean> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.quotas) set.quotas = patch.quotas;
  if (patch.blocks) set.blocks = patch.blocks;
  const [row] = await db.update(runSheets).set(set).where(eq(runSheets.id, id)).returning({ id: runSheets.id });
  return Boolean(row);
}

/** Toggle a single time block's done state (agent action). */
export async function toggleBlock(id: number, index: number, done: boolean): Promise<boolean> {
  const [sheet] = await db.select().from(runSheets).where(eq(runSheets.id, id)).limit(1);
  if (!sheet) return false;
  const blocks = [...sheet.blocks];
  if (index < 0 || index >= blocks.length) return false;
  blocks[index] = { ...blocks[index], done };
  await db.update(runSheets).set({ blocks, updatedAt: new Date() }).where(eq(runSheets.id, id));
  return true;
}
