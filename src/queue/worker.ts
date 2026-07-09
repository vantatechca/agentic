import { getBoss, stopBoss, QUEUE_NAMES } from "./connection";
import type { CommentDispatchJob, PostPublishJob } from "./queues";
import { publishScheduledPost } from "@/scheduler/publish";
import { dispatchAutoComment } from "@/comment-studio/autoDispatch";

/**
 * pg-boss worker process (spec §5 "continuous"). Run standalone:
 *   npm run worker
 *
 * - comment-dispatch: at the window start, YT accounts opted into API
 *   auto-comment post via dispatchAutoComment (full safety gate). Non-opted
 *   accounts stay in the manual console flow (handler no-ops for them).
 * - post-publisher: publishes own-content posts via the platform adapters,
 *   respecting per-account caps (enforced inside publishScheduledPost).
 */
async function main() {
  const boss = await getBoss();
  if (!boss) {
    console.error("❌ DATABASE_URL not set — worker cannot start.");
    process.exit(1);
  }

  await boss.work<CommentDispatchJob>(
    QUEUE_NAMES.commentDispatch,
    { batchSize: 5 },
    async (jobs) => {
      for (const job of jobs) {
        const { alertId, accountId } = job.data;
        console.log(`[worker:comment] dispatch alert=${alertId} account=${accountId}`);
        const result = await dispatchAutoComment(alertId, accountId);
        if (!result.ok) console.log(`[worker:comment] skipped: ${result.reason}`);
      }
    },
  );

  await boss.work<PostPublishJob>(
    QUEUE_NAMES.postPublisher,
    { batchSize: 3 },
    async (jobs) => {
      for (const job of jobs) {
        console.log(`[worker:post] publish scheduledPost=${job.data.scheduledPostId}`);
        await publishScheduledPost(job.data.scheduledPostId);
      }
    },
  );

  console.log("✅ pg-boss workers started: comment-dispatch, post-publisher");
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    console.log(`\n[worker] ${sig} — shutting down…`);
    await stopBoss().catch(() => {});
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
