import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { getCurrentUser } from "@/auth/server";
import { getOrCreateRunSheet } from "@/run/service";
import { OPERATOR_PLATFORM_MAP, ACTION_TYPES, todayStr } from "@/config/operators";
import { RunClient } from "./RunClient";

export const dynamic = "force-dynamic";

export default async function RunPage({ searchParams }: { searchParams: { clientId?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login"); // cookie missing/invalid → real login (Node verify)

  // Which clients can this user work? Agent → assigned; admin → all.
  const visible =
    user.role === "admin"
      ? await db.select().from(clients).orderBy(desc(clients.createdAt))
      : user.agentId
        ? await db.select().from(clients).where(eq(clients.assignedAgentId, user.agentId))
        : [];

  if (visible.length === 0) {
    return (
      <>
        <h1>Today&apos;s run</h1>
        <div className="empty" style={{ marginTop: 16 }}>
          {user.role === "admin"
            ? "No clients yet. Create one in Admin → Clients."
            : "No client assigned to you yet. An admin needs to assign you a client."}
        </div>
      </>
    );
  }

  const selectedId = searchParams.clientId ? Number(searchParams.clientId) : visible[0].id;
  const client = visible.find((c) => c.id === selectedId) ?? visible[0];
  const sheet = await getOrCreateRunSheet(client.id, todayStr());

  const platforms = client.platforms.map((key) => ({
    key,
    label: OPERATOR_PLATFORM_MAP[key]?.label ?? key,
  }));

  return (
    <RunClient
      isAdmin={user.role === "admin"}
      clients={visible.map((c) => ({ id: c.id, name: c.name }))}
      client={{ id: client.id, name: client.name, peakHours: client.peakHours }}
      platforms={platforms}
      actionTypes={ACTION_TYPES.map((a) => ({ key: a.key, label: a.label, countsToQuota: a.countsToQuota }))}
      sheet={sheet!}
    />
  );
}
