import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { pollPlatform } from "@/monitoring/poll";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  platform: z.enum(["youtube", "instagram", "tiktok"]).optional(),
});

// On-demand watchlist poll (spec §5 manual trigger / manual-refresh fallback).
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const platforms = parsed.data.platform
    ? [parsed.data.platform]
    : (["youtube", "instagram", "tiktok"] as const);

  const results: Record<string, unknown> = {};
  for (const p of platforms) {
    try {
      results[p] = await pollPlatform(p);
    } catch (e) {
      results[p] = { error: (e as Error).message };
    }
  }
  return NextResponse.json({ ok: true, results });
}
