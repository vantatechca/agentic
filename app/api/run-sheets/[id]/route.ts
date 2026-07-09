import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateRunSheet, toggleBlock } from "@/run/service";
import { requireUserRoute } from "@/auth/server";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const BlockSchema = z.object({
  start: z.string(),
  end: z.string(),
  label: z.string(),
  type: z.enum(["watch", "post", "admin"]),
  done: z.boolean(),
});

const Body = z.object({
  // admin edit
  quotas: z.record(z.string(), z.number()).optional(),
  blocks: z.array(BlockSchema).optional(),
  // agent toggle
  toggle: z.object({ index: z.number(), done: z.boolean() }).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // A block toggle is an operator action — any authenticated user may do it.
  if (parsed.data.toggle) {
    const auth = await requireUserRoute(req);
    if ("response" in auth) return auth.response;
    const ok = await toggleBlock(id, parsed.data.toggle.index, parsed.data.toggle.done);
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Editing quotas/blocks is admin-only.
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const ok = await updateRunSheet(id, { quotas: parsed.data.quotas, blocks: parsed.data.blocks });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
