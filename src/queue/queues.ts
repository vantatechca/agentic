import { Queue } from "bullmq";
import { getConnection, QUEUE_NAMES } from "./connection";

/**
 * Queue producers (spec §5): comment-queue dispatch (jitter windows) and the
 * scheduled-post publisher (per-account rate caps). Both run "continuous" via a
 * BullMQ worker (src/queue/worker.ts).
 *
 * Jobs are added with delays computed from the comment window / scheduledAt so
 * BullMQ handles the timing; the worker enforces per-account rate caps at
 * execution time.
 */

export type CommentDispatchJob = {
  alertId: number;
  accountId: number;
  runAt: string; // ISO — start of comment window
};

export type PostPublishJob = {
  scheduledPostId: number;
};

let _commentQueue: Queue<CommentDispatchJob> | null = null;
let _postQueue: Queue<PostPublishJob> | null = null;

export function commentQueue(): Queue<CommentDispatchJob> | null {
  const connection = getConnection();
  if (!connection) return null;
  if (!_commentQueue) {
    _commentQueue = new Queue<CommentDispatchJob>(QUEUE_NAMES.commentDispatch, { connection });
  }
  return _commentQueue;
}

export function postQueue(): Queue<PostPublishJob> | null {
  const connection = getConnection();
  if (!connection) return null;
  if (!_postQueue) {
    _postQueue = new Queue<PostPublishJob>(QUEUE_NAMES.postPublisher, { connection });
  }
  return _postQueue;
}

/** Enqueue a comment dispatch at the window start (delay from now). */
export async function enqueueCommentDispatch(job: CommentDispatchJob): Promise<void> {
  const q = commentQueue();
  if (!q) {
    console.log("[queue] no redis — comment dispatch not enqueued:", job);
    return;
  }
  const delay = Math.max(0, new Date(job.runAt).getTime() - Date.now());
  await q.add("dispatch", job, {
    delay,
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

/** Enqueue a scheduled post publish at scheduledAt. */
export async function enqueuePostPublish(scheduledPostId: number, scheduledAt: Date): Promise<void> {
  const q = postQueue();
  if (!q) {
    console.log("[queue] no redis — post publish not enqueued:", scheduledPostId);
    return;
  }
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await q.add("publish", { scheduledPostId }, {
    delay,
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}
