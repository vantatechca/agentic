import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const Body = z.object({ ytAutoComment: z.boolean() });

// Toggle YouTube API auto-comment opt-in per account (spec §11 P4).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [acct] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  if (!acct) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (parsed.data.ytAutoComment && acct.platform !== "youtube") {
    return NextResponse.json({ error: "only YouTube accounts can auto-comment" }, { status: 400 });
  }

  const [updated] = await db
    .update(accounts)
    .set({ ytAutoComment: parsed.data.ytAutoComment, updatedAt: new Date() })
    .where(eq(accounts.id, id))
    .returning();
  return NextResponse.json({ ok: true, account: { id: updated.id, ytAutoComment: updated.ytAutoComment } });
}
