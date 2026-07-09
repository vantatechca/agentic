import IORedis from "ioredis";
import type { ConnectionOptions } from "bullmq";
import { env, capabilities } from "@/env";

/**
 * BullMQ bundles its own copy of ioredis, so our top-level ioredis instance is
 * structurally-but-not-nominally compatible with BullMQ's `ConnectionOptions`.
 * We construct a real ioredis client (correct runtime behavior) and expose it
 * typed as BullMQ's ConnectionOptions to bridge the duplicate-package gap.
 */
export type BullConnection = ConnectionOptions;

/**
 * Shared ioredis connection for BullMQ over Upstash.
 *
 * Upstash + BullMQ requires `maxRetriesPerRequest: null` and TLS (rediss://).
 * When REDIS_URL is absent, `connection` is null and queue producers no-op
 * (logged), so P1 features that don't strictly need the queue still work.
 */
let _connection: BullConnection | null = null;

export function getConnection(): BullConnection | null {
  if (!capabilities.hasRedis) return null;
  if (_connection) return _connection;
  const client = new IORedis(env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  client.on("error", (e) => console.warn("[redis] error:", e.message));
  _connection = client as unknown as BullConnection;
  return _connection;
}

export const QUEUE_NAMES = {
  commentDispatch: "comment-dispatch",
  postPublisher: "post-publisher",
} as const;
