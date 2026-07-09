import PgBoss from "pg-boss";
import { env, capabilities } from "@/env";

/**
 * Queue backend: pg-boss on the existing Neon Postgres — no Redis required.
 *
 * pg-boss stores jobs in its own `pgboss` schema (created automatically on
 * start) alongside the app tables, so the whole platform runs on a single
 * database. Both the web process (producer) and the worker process (consumer)
 * hold their own started instance; each is a long-lived Node process on Render,
 * so a module-level singleton is the right lifetime.
 *
 * Delayed jobs (comment windows, scheduledAt) use pg-boss `startAfter`. If the
 * connection string points at Neon's pooler (LISTEN/NOTIFY unavailable there),
 * pg-boss still delivers via its polling loop — nothing breaks, latency is a
 * couple seconds at most.
 */
export const QUEUE_NAMES = {
  commentDispatch: "comment-dispatch",
  postPublisher: "post-publisher",
} as const;

let _boss: PgBoss | null = null;
let _starting: Promise<PgBoss> | null = null;

export async function getBoss(): Promise<PgBoss | null> {
  if (!capabilities.hasDb) return null;
  if (_boss) return _boss;
  if (_starting) return _starting;

  _starting = (async () => {
    const boss = new PgBoss({
      connectionString: env.DATABASE_URL!,
      // Neon presents a valid public cert; keep verification relaxed so the
      // driver doesn't reject in environments without the CA chain.
      ssl: { rejectUnauthorized: false },
      max: 4,
    });
    boss.on("error", (e) => console.warn("[pgboss] error:", (e as Error).message));
    await boss.start();
    // pg-boss v10 requires explicit queues before send/work. Idempotent.
    for (const name of Object.values(QUEUE_NAMES)) {
      try {
        await boss.createQueue(name);
      } catch {
        /* already exists */
      }
    }
    _boss = boss;
    return boss;
  })();

  return _starting;
}

/** Gracefully stop the boss (used by the worker on shutdown). */
export async function stopBoss(): Promise<void> {
  if (_boss) {
    await _boss.stop({ graceful: true });
    _boss = null;
    _starting = null;
  }
}
