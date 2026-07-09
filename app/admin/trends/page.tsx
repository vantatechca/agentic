import { desc } from "drizzle-orm";
import { db } from "@/db";
import { trends, niches } from "@/db/schema";
import { capabilities } from "@/env";
import { TrendsClient } from "./TrendsClient";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  if (!capabilities.hasDb) {
    return (
      <>
        <h1>Trend Radar</h1>
        <div className="empty">Database not configured.</div>
      </>
    );
  }

  const [trendRows, nicheRows] = await Promise.all([
    db.select().from(trends).orderBy(desc(trends.capturedAt)).limit(60),
    db.select().from(niches),
  ]);

  return (
    <>
      <h1>Trend Radar</h1>
      <p className="subtle">
        Per-niche opportunities from Google Trends + YouTube. Approve proposed trending hashtags
        before they enter the mixer rotation.
      </p>
      <TrendsClient
        aiOn={capabilities.hasAnyAI}
        trends={trendRows.map((t) => ({
          id: t.id,
          nicheKey: t.nicheKey,
          platform: t.platform,
          topic: t.topic,
          whyNow: t.whyNow,
          contentAngle: t.contentAngle,
          commentAngle: t.commentAngle,
          score: t.score,
          source: t.source,
        }))}
        niches={nicheRows.map((n) => ({
          key: n.key,
          name: n.name,
          trending: n.hashtagBank.trending,
        }))}
      />
    </>
  );
}
