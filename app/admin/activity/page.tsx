import { desc } from "drizzle-orm";
import { db } from "@/db";
import { actionLog, clients, agents } from "@/db/schema";
import { capabilities } from "@/env";
import { ActivityTable } from "../../components/ActivityTable";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  if (!capabilities.hasDb) {
    return (<><h1>URL / Activity Log</h1><div className="empty">Database not configured.</div></>);
  }
  const [rows, clientRows, agentRows] = await Promise.all([
    db.select().from(actionLog).orderBy(desc(actionLog.createdAt)).limit(300),
    db.select({ id: clients.id, name: clients.name }).from(clients),
    db.select({ id: agents.id, name: agents.name }).from(agents),
  ]);
  const clientMap = Object.fromEntries(clientRows.map((c) => [c.id, c.name]));
  const agentMap = Object.fromEntries(agentRows.map((a) => [a.id, a.name]));

  return (
    <>
      <h1>URL / Activity Log</h1>
      <p className="subtle">
        Every logged operator action, with the target post URL and the resulting comment/post URL.
        This is the canonical record of all posts and commented posts.
      </p>
      <ActivityTable
        showAgent
        rows={rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          client: r.clientId ? clientMap[r.clientId] ?? `#${r.clientId}` : "—",
          agent: r.agentId ? agentMap[r.agentId] ?? `#${r.agentId}` : "—",
          platform: r.platform,
          actionType: r.actionType,
          targetUrl: r.targetUrl,
          resultUrl: r.resultUrl,
          note: r.note,
        }))}
      />
    </>
  );
}
