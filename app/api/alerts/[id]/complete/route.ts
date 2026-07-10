import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { getNiche } from "@/niches/registry";
import { recordComment } from "@/comment-studio/record";
import { requireUserRoute } from "@/auth/server";

export const dynamic = "force-dynamic";

const Body = z.object({
  accountId: z.number(),
  chosenText: z.string().min(1),
  tone: z.string().optional(),
});

// Mark an alert done: paste-confirm records the posted comment (method=manual)
// after passing the final safety gate. (spec §9)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserRoute(req);
  if ("response" in auth) return auth.response;

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [alert] = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
  if (!alert) return NextResponse.json({ error: "not found" }, { status: 404 });

  const niche = await getNiche(alert.nicheKey);
  if (!niche) return NextResponse.json({ error: "niche not found" }, { status: 400 });

  const result = await recordComment({
    alertId: alert.id,
    accountId: parsed.data.accountId,
    nicheKey: alert.nicheKey,
    videoUrl: alert.postUrl,
    chosenText: parsed.data.chosenText,
    tone: parsed.data.tone,
    method: "manual",
    nicheBanned: niche.bannedWords,
  });

  if (!result.ok) return NextResponse.json({ ok: false, reason: result.reason }, { status: 409 });
  return NextResponse.json({ ok: true, commentId: result.commentId });
}
