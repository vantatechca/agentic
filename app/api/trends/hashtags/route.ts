import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { setTrendingApproval, proposeTrendingTags } from "@/banks/trending";

export const dynamic = "force-dynamic";

const Body = z.object({
  nicheKey: z.string().min(1),
  tag: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  action: z.enum(["approve", "reject", "propose"]),
  ttlDays: z.number().int().min(1).max(60).optional(),
});

// Approve/reject a proposed trending hashtag, or propose new ones (spec §8).
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  if (b.action === "propose") {
    const list = b.tags ?? (b.tag ? [b.tag] : []);
    if (!list.length) return NextResponse.json({ error: "no tags provided" }, { status: 400 });
    const added = await proposeTrendingTags(b.nicheKey, list, b.ttlDays);
    return NextResponse.json({ ok: true, proposed: added });
  }

  if (!b.tag) return NextResponse.json({ error: "tag required" }, { status: 400 });
  const ok = await setTrendingApproval(b.nicheKey, b.tag, b.action === "approve");
  if (!ok) return NextResponse.json({ ok: false, error: "tag not found" }, { status: 404 });
  return NextResponse.json({ ok: true, tag: b.tag, approved: b.action === "approve" });
}
