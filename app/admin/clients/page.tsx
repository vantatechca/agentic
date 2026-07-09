import { desc } from "drizzle-orm";
import { db } from "@/db";
import { clients, agents } from "@/db/schema";
import { listNiches } from "@/niches/registry";
import { OPERATOR_PLATFORMS } from "@/config/operators";
import { capabilities } from "@/env";
import { ClientsClient } from "./ClientsClient";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  if (!capabilities.hasDb) {
    return (<><h1>Clients</h1><div className="empty">Database not configured.</div></>);
  }
  const [clientRows, agentRows, niches] = await Promise.all([
    db.select().from(clients).orderBy(desc(clients.createdAt)).limit(200),
    db.select({ id: agents.id, name: agents.name }).from(agents),
    listNiches().catch(() => []),
  ]);

  return (
    <>
      <h1>Clients</h1>
      <p className="subtle">
        Each client is a brand assigned to one agent, with its own platforms. The run-sheet quota
        cards and daily time blocks follow the client&apos;s platforms.
      </p>
      <ClientsClient
        clients={clientRows.map((c) => ({
          id: c.id, name: c.name, nicheKey: c.nicheKey, assignedAgentId: c.assignedAgentId,
          platforms: c.platforms, peakHours: c.peakHours, status: c.status,
        }))}
        agents={agentRows}
        niches={niches.map((n) => ({ key: n.key, name: n.name }))}
        platforms={OPERATOR_PLATFORMS.map((p) => ({ key: p.key, label: p.label }))}
      />
    </>
  );
}
