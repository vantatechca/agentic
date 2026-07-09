import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireAdmin } from "@/lib/adminAuth";
import { OPERATOR_PLATFORM_KEYS } from "@/config/operators";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1).optional(),
  nicheKey: z.string().nullable().optional(),
  assignedAgentId: z.number().nullable().optional(),
  platforms: z.array(z.enum(OPERATOR_PLATFORM_KEYS as [string, ...string[]])).optional(),
  peakHours: z.string().nullable().optional(),
  status: z.enum(["active", "paused"]).optional(),
  notes: z.string().nullable().optional(),
});

// Update a client (admin): reassign agent, edit platforms/peak hours/status.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const patch = { ...parsed.data } as Record<string, unknown>;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no changes" }, { status: 400 });

  const [c] = await db.update(clients).set(patch).where(eq(clients.id, id)).returning();
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, client: c });
}
