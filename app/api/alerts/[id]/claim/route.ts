import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts } from "@/db/schema";

export const dynamic = "force-dynamic";

// Agent claims an alert (spec §9: Claim → copy → paste → mark done).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const [updated] = await db
    .update(alerts)
    .set({ status: "claimed" })
    .where(eq(alerts.id, id))
    .returning();
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, alert: updated });
}
