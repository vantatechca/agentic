import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { requireUserRoute } from "@/auth/server";

export const dynamic = "force-dynamic";

// Agent claims an alert (spec §9: Claim → copy → paste → mark done).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserRoute(req);
  if ("response" in auth) return auth.response;

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
