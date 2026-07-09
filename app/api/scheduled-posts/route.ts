import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { scheduledPosts } from "@/db/schema";
import { requireAdmin } from "@/lib/adminAuth";
import { createScheduledPost } from "@/scheduler/create";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const rows = await db
    .select()
    .from(scheduledPosts)
    .orderBy(desc(scheduledPosts.scheduledAt))
    .limit(100);
  return NextResponse.json({ posts: rows });
}

const Body = z.object({
  accountId: z.number(),
  scheduledAt: z.string().datetime(),
  mediaId: z.number().optional(),
  mediaUrl: z.string().url().optional(),
  caption: z.string().optional(),
  generate: z
    .object({
      topic: z.string(),
      mediaDescription: z.string(),
      ctaGoal: z.string(),
      verifiedFacts: z.array(z.string()).optional(),
    })
    .optional(),
});

// Create + enqueue a scheduled own-content post.
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  try {
    const result = await createScheduledPost({
      accountId: b.accountId,
      scheduledAt: new Date(b.scheduledAt),
      mediaId: b.mediaId,
      mediaUrl: b.mediaUrl,
      caption: b.caption,
      generate: b.generate,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
