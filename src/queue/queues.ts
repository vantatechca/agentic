import { getBoss, QUEUE_NAMES } from "./connection";

/**
 * Queue producers (spec §5): comment-queue dispatch (jitter windows) and the
 * scheduled-post publisher (per-account rate caps). Both are continuous via the
 * pg-boss worker (src/queue/worker.ts).
 *
 * Jobs are scheduled with `startAfter` (the comment window start / scheduledAt)
 * so pg-boss handles the timing; the worker enforces per-account rate caps at
 * execution time. When no database is configured, producers no-op (logged) so
 * P1 features that don't strictly need the queue still work.
 */

export type CommentDispatchJob = {
  alertId: number;
  accountId: number;
  runAt: string; // ISO — start of comment window
};

export type PostPublishJob = {
  scheduledPostId: number;
};

/** Enqueue a comment dispatch at the window start. */
export async function enqueueCommentDispatch(job: CommentDispatchJob): Promise<void> {
  const boss = await getBoss();
  if (!boss) {
    console.log("[queue] no database — comment dispatch not enqueued:", job);
    return;
  }
  await boss.send(QUEUE_NAMES.commentDispatch, job, {
    startAfter: new Date(job.runAt),
    retryLimit: 3,
    retryDelay: 5, // seconds
    retryBackoff: true,
    expireInSeconds: 600,
  });
}

/** Enqueue a scheduled post publish at scheduledAt. */
export async function enqueuePostPublish(scheduledPostId: number, scheduledAt: Date): Promise<void> {
  const boss = await getBoss();
  if (!boss) {
    console.log("[queue] no database — post publish not enqueued:", scheduledPostId);
    return;
  }
  await boss.send(
    QUEUE_NAMES.postPublisher,
    { scheduledPostId },
    {
      startAfter: scheduledAt,
      retryLimit: 3,
      retryDelay: 10,
      retryBackoff: true,
    },
  );
}
