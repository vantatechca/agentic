import { desc } from "drizzle-orm";
import { db } from "@/db";
import { scheduledPosts, accounts, mediaAssets } from "@/db/schema";
import { capabilities } from "@/env";
import { SchedulerClient } from "./SchedulerClient";

export const dynamic = "force-dynamic";

export default async function SchedulerPage() {
  if (!capabilities.hasDb) {
    return (
      <>
        <h1>Scheduler</h1>
        <div className="empty">Database not configured.</div>
      </>
    );
  }

  const [posts, acctRows, media] = await Promise.all([
    db.select().from(scheduledPosts).orderBy(desc(scheduledPosts.scheduledAt)).limit(60),
    db.select().from(accounts).limit(200),
    db.select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt)).limit(100),
  ]);

  return (
    <>
      <h1>Posting Scheduler</h1>
      <p className="subtle">
        Own-content posting. YouTube + Instagram auto (with account tokens); TikTok reminder-fallback.
      </p>
      <SchedulerClient
        accounts={acctRows.map((a) => ({ id: a.id, handle: a.handle, platform: a.platform, nicheKey: a.nicheKey }))}
        media={media.map((m) => ({ id: m.id, kind: m.kind, url: m.url, description: m.description }))}
        posts={posts.map((p) => ({
          id: p.id,
          platform: p.platform,
          accountId: p.accountId,
          caption: p.caption,
          status: p.status,
          scheduledAt: p.scheduledAt.toISOString(),
          postedUrl: p.postedUrl,
          error: p.error,
        }))}
      />
    </>
  );
}
