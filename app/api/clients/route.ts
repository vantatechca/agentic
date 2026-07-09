import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireAdmin } from "@/lib/adminAuth";
import { OPERATOR_PLATFORM_KEYS } from "@/config/operators";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const rows = await db.select().from(clients).orderBy(desc(clients.createdAt)).limit(200);
  return NextResponse.json({ clients: rows });
}

const Body = z.object({
  name: z.string().min(1),
  nicheKey: z.string().optional(),
  assignedAgentId: z.number().nullable().optional(),
  platforms: z.array(z.enum(OPERATOR_PLATFORM_KEYS as [string, ...string[]])).default([]),
  peakHours: z.string().optional(),
  notes: z.string().optional(),
});

// Create a client/brand (admin), assigned to one agent, with its platforms.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const [c] = await db
    .insert(clients)
    .values({
      name: b.name,
      nicheKey: b.nicheKey ?? null,
      assignedAgentId: b.assignedAgentId ?? null,
      platforms: b.platforms,
      peakHours: b.peakHours ?? null,
      notes: b.notes ?? null,
    })
    .returning();
  return NextResponse.json({ ok: true, client: c });
}
