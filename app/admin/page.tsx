import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { clients, users, agents, accounts, actionLog } from "@/db/schema";
import { capabilities } from "@/env";

export const dynamic = "force-dynamic";

async function count(table: PgTable): Promise<number> {
  try {
    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(table);
    return Number(c) || 0;
  } catch {
    return 0;
  }
}

export default async function AdminHome() {
  if (!capabilities.hasDb) {
    return (
      <>
        <h1>Admin Control</h1>
        <div className="empty">Database not configured.</div>
      </>
    );
  }

  const [clientCount, userCount, agentCount, accountCount] = await Promise.all([
    count(clients),
    count(users),
    count(agents),
    count(accounts),
  ]);

  const [{ actionsToday }] = await db
    .select({ actionsToday: sql<number>`count(*)::int` })
    .from(actionLog)
    .where(sql`${actionLog.createdAt} >= current_date`)
    .catch(() => [{ actionsToday: 0 }] as { actionsToday: number }[]);

  const cards: { href: string; title: string; desc: string }[] = [
    { href: "/admin/clients", title: "Clients", desc: "Brands, platforms, agent assignment, run sheets" },
    { href: "/admin/users", title: "Users", desc: "Create operator/admin login accounts" },
    { href: "/admin/activity", title: "URL / Activity Log", desc: "Every logged post & comment URL" },
    { href: "/admin/fleet", title: "Fleet Health", desc: "Account budgets, cooldowns, banks" },
    { href: "/admin/targets", title: "Watch Targets", desc: "Monitoring + manual refresh" },
    { href: "/admin/trends", title: "Trend Radar", desc: "Scans + hashtag approval" },
    { href: "/admin/scheduler", title: "Scheduler", desc: "Own-content posting" },
    { href: "/admin/analytics", title: "Analytics", desc: "What works + agent stats" },
  ];

  return (
    <>
      <h1>Admin Control</h1>
      <p className="subtle">Everything the fleet runs on, in one place.</p>

      <div className="grid cols-4" style={{ marginTop: 16 }}>
        <Stat label="Clients" value={clientCount} />
        <Stat label="Users" value={userCount} />
        <Stat label="Agents" value={agentCount} />
        <Stat label="Actions today" value={Number(actionsToday) || 0} />
      </div>

      <h2>Manage</h2>
      <div className="grid cols-3">
        {cards.map((c) => (
          <a key={c.href} href={c.href} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ fontWeight: 600 }}>{c.title}</div>
            <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>{c.desc}</div>
          </a>
        ))}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="stat">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
