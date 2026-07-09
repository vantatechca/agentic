import { Worker } from "bullmq";
import { getConnection, QUEUE_NAMES } from "./connection";
import type { CommentDispatchJob, PostPublishJob } from "./queues";
import { publishScheduledPost } from "@/scheduler/publish";
import { dispatchAutoComment } from "@/comment-studio/autoDispatch";

/**
 * BullMQ worker process (spec §5 "continuous"). Run standalone:
 *   npm run worker
 *
 * - comment-dispatch: at window start, the alert becomes actionable. In P1 the
 *   flow is human paste via AdsPower, so dispatch just ensures the alert is
 *   surfaced/kept warm; API auto-commenting (P4 opt-in) hooks in here.
 * - post-publisher: publishes own-content posts via the platform adapters,
 *   respecting per-account caps (enforced inside publishScheduledPost).
 */

function main() {
  const connection = getConnection();
  if (!connection) {
    console.error("❌ REDIS_URL not set — worker cannot start.");
    process.exit(1);
  }

  const commentWorker = new Worker<CommentDispatchJob>(
    QUEUE_NAMES.commentDispatch,
    async (job) => {
      console.log(`[worker:comment] dispatch alert=${job.data.alertId} account=${job.data.accountId}`);
      // P4: YT API auto-comment for opted-in accounts. For non-opted accounts
      // dispatchAutoComment returns ok:false (manual flow stays in the console).
      const result = await dispatchAutoComment(job.data.alertId, job.data.accountId);
      if (!result.ok) console.log(`[worker:comment] skipped: ${result.reason}`);
      return result;
    },
    { connection, concurrency: 5 },
  );

  const postWorker = new Worker<PostPublishJob>(
    QUEUE_NAMES.postPublisher,
    async (job) => {
      console.log(`[worker:post] publish scheduledPost=${job.data.scheduledPostId}`);
      return publishScheduledPost(job.data.scheduledPostId);
    },
    { connection, concurrency: 3 },
  );

  for (const w of [commentWorker, postWorker]) {
    w.on("failed", (job, err) => console.error(`[worker] ${w.name} job ${job?.id} failed:`, err.message));
    w.on("completed", (job) => console.log(`[worker] ${w.name} job ${job.id} completed`));
  }

  console.log("✅ Workers started: comment-dispatch, post-publisher");
}

main();
