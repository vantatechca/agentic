import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { watchTargets } from "@/db/schema";
import { requireAdmin } from "@/lib/adminAuth";
import { resolveChannelId } from "@/monitoring/youtube";

export const dynamic = "force-dynamic";

// List watch targets.
export async function GET() {
  const rows = await db
    .select()
    .from(watchTargets)
    .orderBy(desc(watchTargets.createdAt))
    .limit(200);
  return NextResponse.json({ targets: rows });
}

const Body = z.object({
  platform: z.enum(["youtube", "instagram", "tiktok"]),
  handle: z.string().min(1),
  nicheKey: z.string().min(1),
  channelId: z.string().optional(),
  checkFrequencySec: z.number().int().min(60).optional(),
});

// Add a watch target. For YouTube, resolves @handle/URL → channelId when a
// YOUTUBE_API_KEY is present (RSS needs a channelId).
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  let channelId = b.channelId ?? null;
  if (b.platform === "youtube" && !channelId) {
    channelId = await resolveChannelId(b.handle);
    if (!channelId) {
      return NextResponse.json(
        { error: "Could not resolve YouTube channelId. Provide channelId explicitly or set YOUTUBE_API_KEY." },
        { status: 422 },
      );
    }
  }

  const [inserted] = await db
    .insert(watchTargets)
    .values({
      platform: b.platform,
      handle: b.handle,
      channelId,
      nicheKey: b.nicheKey,
      checkFrequency: b.checkFrequencySec ?? (b.platform === "youtube" ? 300 : 1200),
    })
    .onConflictDoNothing({ target: [watchTargets.platform, watchTargets.handle] })
    .returning();

  if (!inserted) return NextResponse.json({ ok: false, error: "target already exists" }, { status: 409 });
  return NextResponse.json({ ok: true, target: inserted });
}
