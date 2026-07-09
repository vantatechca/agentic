import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { watchTargets } from "@/db/schema";
import { requireAdmin } from "@/lib/adminAuth";
import { pollPlatform } from "@/monitoring/poll";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Manual-refresh (spec §3 fallback). Clears any open circuit for the target and
 * re-polls its platform, so a human can force a check when scrapers were blocked.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const [target] = await db.select().from(watchTargets).where(eq(watchTargets.id, id)).limit(1);
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Reset circuit breaker so this refresh actually runs.
  await db
    .update(watchTargets)
    .set({ circuitOpenUntil: null, consecutiveFailures: 0 })
    .where(eq(watchTargets.id, id));

  const result = await pollPlatform(target.platform);
  return NextResponse.json({ ok: true, platform: target.platform, result });
}
