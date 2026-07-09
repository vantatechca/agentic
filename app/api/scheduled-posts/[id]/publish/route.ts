import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { publishScheduledPost } from "@/scheduler/publish";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// Publish a scheduled post immediately (manual trigger / no-Redis fallback).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const result = await publishScheduledPost(id);
  return NextResponse.json({ ok: true, ...result });
}
