import { eq } from "drizzle-orm";
import { env } from "@/env";
import { db } from "@/db";
import { niches } from "@/db/schema";

/**
 * Discord integration (spec §10). Posts to per-niche channels via webhooks:
 *   #alerts-{niche}, #trends-{niche}, #fleet-health
 *
 * v1 uses webhook URLs. A niche may override the alerts/trends webhook via its
 * profile blob (profile.discord = { alertsWebhook, trendsWebhook }); otherwise
 * the global env webhooks are used. When no webhook is configured at all, the
 * message is logged (never throws) so the fleet keeps running.
 */

type WebhookKind = "alerts" | "trends" | "fleet-health";

async function resolveWebhook(kind: WebhookKind, nicheKey?: string): Promise<string | null> {
  if (kind === "fleet-health") return env.DISCORD_WEBHOOK_FLEET_HEALTH ?? null;

  // niche override
  if (nicheKey) {
    const [n] = await db
      .select({ profile: niches.profile })
      .from(niches)
      .where(eq(niches.key, nicheKey))
      .limit(1);
    const discord = (n?.profile as { discord?: Record<string, string> } | undefined)?.discord;
    const override = kind === "alerts" ? discord?.alertsWebhook : discord?.trendsWebhook;
    if (override) return override;
  }
  return (kind === "alerts" ? env.DISCORD_WEBHOOK_ALERTS : env.DISCORD_WEBHOOK_TRENDS) ?? null;
}

async function post(webhook: string, content: string, embeds?: unknown[]): Promise<void> {
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.slice(0, 2000), embeds }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Discord webhook ${res.status}: ${await res.text()}`);
  }
}

async function send(
  kind: WebhookKind,
  content: string,
  opts: { nicheKey?: string; embeds?: unknown[] } = {},
): Promise<void> {
  const webhook = await resolveWebhook(kind, opts.nicheKey);
  if (!webhook) {
    console.log(`[discord:${kind}${opts.nicheKey ? `:${opts.nicheKey}` : ""}] ${content}`);
    return;
  }
  await post(webhook, content, opts.embeds);
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** #alerts-{niche} — new-upload alert. */
export async function notifyAlert(
  nicheKey: string,
  args: { targetHandle: string; postUrl: string; agentName?: string; window?: string },
): Promise<void> {
  const lines = [
    `🔔 New upload from **${args.targetHandle}**`,
    `🔗 ${args.postUrl}`,
    args.agentName ? `👤 Assigned: ${args.agentName}` : null,
    args.window ? `⏱️ Window: ${args.window}` : null,
  ].filter(Boolean);
  await send("alerts", lines.join("\n"), { nicheKey });
}

/** #trends-{niche} — daily digest. */
export async function notifyTrendDigest(nicheKey: string, content: string): Promise<void> {
  await send("trends", content, { nicheKey });
}

/** #fleet-health — cooldowns, pauses, circuit-breaker trips. */
export async function notifyFleetHealth(content: string): Promise<void> {
  await send("fleet-health", content);
}
