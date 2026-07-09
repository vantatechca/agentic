import { sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, alerts, comments, agents } from "@/db/schema";
import { capabilities } from "@/env";

export const dynamic = "force-dynamic";

async function safeCount(fn: () => Promise<number>): Promise<number | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const dbReady = capabilities.hasDb;

  const [accountCount, activeCount, openAlerts, commentsToday, agentCount] = dbReady
    ? await Promise.all([
        safeCount(async () => Number((await db.select({ c: sql<number>`count(*)::int` }).from(accounts))[0].c)),
        safeCount(async () =>
          Number(
            (
              await db
                .select({ c: sql<number>`count(*)::int` })
                .from(accounts)
                .where(sql`${accounts.status} = 'active'`)
            )[0].c,
          ),
        ),
        safeCount(async () =>
          Number(
            (
              await db
                .select({ c: sql<number>`count(*)::int` })
                .from(alerts)
                .where(sql`${alerts.status} in ('new','claimed')`)
            )[0].c,
          ),
        ),
        safeCount(async () =>
          Number(
            (
              await db
                .select({ c: sql<number>`count(*)::int` })
                .from(comments)
                .where(sql`${comments.postedAt} >= current_date`)
            )[0].c,
          ),
        ),
        safeCount(async () => Number((await db.select({ c: sql<number>`count(*)::int` }).from(agents))[0].c)),
      ])
    : [null, null, null, null, null];

  return (
    <>
      <h1>Fleet Dashboard</h1>
      <p className="subtle">Engagement + own-content posting across YouTube, Instagram, TikTok.</p>

      {!dbReady && (
        <div className="empty" style={{ marginTop: 16 }}>
          <strong>Database not configured.</strong> Set <span className="mono">DATABASE_URL</span> and run{" "}
          <span className="mono">npm run db:push &amp;&amp; npm run db:seed</span> to bring the fleet online.
        </div>
      )}

      <div className="grid cols-4" style={{ marginTop: 20 }}>
        <Stat label="Accounts" value={accountCount} sub={`${activeCount ?? "–"} active`} />
        <Stat label="Open alerts" value={openAlerts} />
        <Stat label="Comments today" value={commentsToday} />
        <Stat label="Agents" value={agentCount} />
      </div>

      <h2>System capabilities</h2>
      <div className="grid cols-3">
        <Cap label="AI provider" ok={capabilities.hasAnyAI} detail={capabilities.hasDeepSeek ? "DeepSeek→Claude" : capabilities.hasClaude ? "Claude only" : "none"} />
        <Cap label="Queue (Postgres)" ok={capabilities.hasQueue} detail="pg-boss dispatch" />
        <Cap label="YouTube API" ok={capabilities.hasYouTube} detail="trends + posting" />
        <Cap label="Scrapers (Apify)" ok={capabilities.hasApify} detail="IG/TikTok enrich" />
        <Cap label="Database" ok={capabilities.hasDb} detail="Neon Postgres" />
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | null; sub?: string }) {
  return (
    <div className="card">
      <div className="stat">{value ?? "–"}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="subtle" style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Cap({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div className="subtle" style={{ fontSize: 12 }}>{detail}</div>
      </div>
      <span className={`badge ${ok ? "active" : "paused"}`}>{ok ? "ready" : "off"}</span>
    </div>
  );
}
