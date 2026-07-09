import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, accounts, alerts } from "@/db/schema";
import { makeCommentWindow, formatWindow } from "@/safety/jitter";
import { enqueueCommentDispatch } from "@/queue/queues";

/**
 * Agent console assignment (spec §9). New alerts are auto-assigned round-robin
 * to agents whose assignedNiches include the alert's niche, and paired with an
 * eligible (active) fleet account in that niche+platform. A jittered comment
 * window is attached.
 *
 * Round-robin is implemented by picking the eligible agent with the fewest
 * currently-open (new/claimed) alerts — a self-balancing form of round-robin
 * that survives restarts without a cursor.
 */

export type AssignResult = {
  agentId: number | null;
  agentName: string | null;
  accountId: number | null;
  window: { start: Date; end: Date } | null;
  windowLabel: string | null;
};

export async function assignAlert(alertId: number): Promise<AssignResult> {
  const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId)).limit(1);
  if (!alert) throw new Error(`alert ${alertId} not found`);

  // 1) eligible agents for this niche, ranked by current open workload asc
  const eligibleAgents = await db
    .select({
      id: agents.id,
      name: agents.name,
      open: sql<number>`(
        select count(*)::int from ${alerts} a
        where a.assigned_agent_id = ${agents.id}
          and a.status in ('new','claimed')
      )`,
    })
    .from(agents)
    .where(
      and(
        eq(agents.active, true),
        sql`${agents.assignedNiches} ? ${alert.nicheKey}`,
      ),
    )
    .orderBy(sql`open asc`)
    .limit(1);

  const agent = eligibleAgents[0] ?? null;

  // 2) an active account in this niche + platform, least-recently-used
  const [account] = await db
    .select({ id: accounts.id, ytAutoComment: accounts.ytAutoComment, platform: accounts.platform })
    .from(accounts)
    .where(
      and(
        eq(accounts.nicheKey, alert.nicheKey),
        eq(accounts.platform, alert.platform),
        eq(accounts.status, "active"),
      ),
    )
    .orderBy(sql`${accounts.lastActionAt} asc nulls first`)
    .limit(1);

  // 3) stagger window using count of alerts already assigned on this target now
  const [{ count: staggerCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(alerts)
    .where(
      and(
        eq(alerts.watchTargetId, alert.watchTargetId),
        sql`${alerts.commentWindowStart} is not null`,
      ),
    );

  const window = makeCommentWindow(new Date(), Number(staggerCount) || 0);

  await db
    .update(alerts)
    .set({
      assignedAgentId: agent?.id ?? null,
      assignedAccountId: account?.id ?? null,
      status: agent ? "claimed" : "new",
      commentWindowStart: window.start,
      commentWindowEnd: window.end,
    })
    .where(eq(alerts.id, alertId));

  // P4: for opted-in YouTube accounts, enqueue an auto-comment dispatch at the
  // window start. Non-opted accounts stay in the manual console flow.
  if (account && account.platform === "youtube" && account.ytAutoComment) {
    await enqueueCommentDispatch({
      alertId,
      accountId: account.id,
      runAt: window.start.toISOString(),
    }).catch((e) => console.warn("[assign] enqueue dispatch failed:", (e as Error).message));
  }

  return {
    agentId: agent?.id ?? null,
    agentName: agent?.name ?? null,
    accountId: account?.id ?? null,
    window,
    windowLabel: formatWindow(window),
  };
}
