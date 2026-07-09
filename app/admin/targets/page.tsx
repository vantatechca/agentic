import { desc } from "drizzle-orm";
import { db } from "@/db";
import { watchTargets, niches } from "@/db/schema";
import { capabilities } from "@/env";
import { TargetsClient } from "./TargetsClient";

export const dynamic = "force-dynamic";

export default async function TargetsPage() {
  if (!capabilities.hasDb) {
    return (
      <>
        <h1>Watch Targets</h1>
        <div className="empty">Database not configured.</div>
      </>
    );
  }
  const [rows, nicheRows] = await Promise.all([
    db.select().from(watchTargets).orderBy(desc(watchTargets.createdAt)).limit(200),
    db.select({ key: niches.key, name: niches.name }).from(niches),
  ]);

  const now = Date.now();
  return (
    <>
      <h1>Watch Targets</h1>
      <p className="subtle">
        Monitored accounts. YouTube via RSS (auto). IG/TikTok best-effort; on repeated blocks the
        circuit opens and the target drops to manual-refresh.
      </p>
      <TargetsClient
        niches={nicheRows}
        apifyOn={capabilities.hasApify}
        targets={rows.map((t) => ({
          id: t.id,
          platform: t.platform,
          handle: t.handle,
          nicheKey: t.nicheKey,
          channelId: t.channelId,
          enabled: t.enabled,
          consecutiveFailures: t.consecutiveFailures,
          circuitOpen: Boolean(t.circuitOpenUntil && t.circuitOpenUntil.getTime() > now),
          lastCheckedAt: t.lastCheckedAt ? t.lastCheckedAt.toISOString() : null,
        }))}
      />
    </>
  );
}
