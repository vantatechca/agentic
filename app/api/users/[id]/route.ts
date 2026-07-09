import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/adminAuth";
import { hashPassword } from "@/auth/password";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
  active: z.boolean().optional(),
});

// Update a user (admin): rename, reset password, activate/deactivate.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.active !== undefined) patch.active = parsed.data.active;
  if (parsed.data.password) patch.passwordHash = await hashPassword(parsed.data.password);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no changes" }, { status: 400 });

  const [u] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, id))
    .returning({ id: users.id, active: users.active });
  if (!u) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, user: u });
}
