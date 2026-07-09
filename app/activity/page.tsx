import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { actionLog, clients } from "@/db/schema";
import { getCurrentUser } from "@/auth/server";
import { ActivityTable } from "../components/ActivityTable";

export const dynamic = "force-dynamic";

export default async function MyActivityPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Admins get the full log page; agents see only their own actions here.
  const rows = await db
    .select()
    .from(actionLog)
    .where(user.agentId ? and(eq(actionLog.agentId, user.agentId)) : undefined)
    .orderBy(desc(actionLog.createdAt))
    .limit(300);

  const clientRows = await db.select({ id: clients.id, name: clients.name }).from(clients);
  const clientMap = Object.fromEntries(clientRows.map((c) => [c.id, c.name]));

  return (
    <>
      <h1>My Activity</h1>
      <p className="subtle">Everything you&apos;ve logged — target posts and the URLs of your comments/posts.</p>
      <ActivityTable
        rows={rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          client: r.clientId ? clientMap[r.clientId] ?? `#${r.clientId}` : "—",
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
