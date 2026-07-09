import { desc, inArray, eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts, accounts, agents } from "@/db/schema";
import { capabilities } from "@/env";
import { AlertCard } from "./AlertCard";
import { formatWindow } from "@/safety/jitter";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  if (!capabilities.hasDb) {
    return (
      <>
        <h1>Agent Console</h1>
        <div className="empty">Database not configured.</div>
      </>
    );
  }

  const rows = await db
    .select()
    .from(alerts)
    .where(inArray(alerts.status, ["new", "claimed"]))
    .orderBy(desc(alerts.detectedAt))
    .limit(50);

  // Resolve account + agent labels
  const acctMap = new Map<number, typeof accounts.$inferSelect>();
  const agentMap = new Map<number, typeof agents.$inferSelect>();
  for (const r of rows) {
    if (r.assignedAccountId && !acctMap.has(r.assignedAccountId)) {
      const [a] = await db.select().from(accounts).where(eq(accounts.id, r.assignedAccountId)).limit(1);
      if (a) acctMap.set(r.assignedAccountId, a);
    }
    if (r.assignedAgentId && !agentMap.has(r.assignedAgentId)) {
      const [a] = await db.select().from(agents).where(eq(agents.id, r.assignedAgentId)).limit(1);
      if (a) agentMap.set(r.assignedAgentId, a);
    }
  }

  return (
    <>
      <h1>Agent Console</h1>
      <p className="subtle">
        Auto-assigned task feed. Claim → generate → copy → paste in AdsPower → mark done.
      </p>

      {rows.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>
          No open alerts. New uploads from watch targets appear here automatically.
        </div>
      ) : (
        <div className="grid" style={{ marginTop: 16 }}>
          {rows.map((r) => {
            const acct = r.assignedAccountId ? acctMap.get(r.assignedAccountId) : undefined;
            const agent = r.assignedAgentId ? agentMap.get(r.assignedAgentId) : undefined;
            const window =
              r.commentWindowStart && r.commentWindowEnd
                ? formatWindow({ start: r.commentWindowStart, end: r.commentWindowEnd })
                : null;
            return (
              <AlertCard
                key={r.id}
                alert={{
                  id: r.id,
                  platform: r.platform,
                  nicheKey: r.nicheKey,
                  postUrl: r.postUrl,
                  title: r.title,
                  status: r.status,
                  window,
                  accountId: acct?.id ?? null,
                  accountHandle: acct?.handle ?? null,
                  adsPowerProfileId: acct?.adsPowerProfileId ?? null,
                  agentName: agent?.name ?? null,
                }}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
