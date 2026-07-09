import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { actionLog } from "@/db/schema";
import { requireUserRoute } from "@/auth/server";
import { OPERATOR_PLATFORM_KEYS, ACTION_TYPE_MAP } from "@/config/operators";

export const dynamic = "force-dynamic";

// List logged actions (the post/comment URL record). Filter by client/type.
export async function GET(req: NextRequest) {
  const auth = await requireUserRoute(req);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const actionType = searchParams.get("type");

  const conds = [];
  if (clientId) conds.push(eq(actionLog.clientId, Number(clientId)));
  if (actionType) conds.push(eq(actionLog.actionType, actionType));
  // Agents only see their own logged actions; admins see all.
  if (auth.user.role === "agent" && auth.user.agentId) {
    conds.push(eq(actionLog.agentId, auth.user.agentId));
  }

  const rows = await db
    .select()
    .from(actionLog)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(actionLog.createdAt))
    .limit(300);
  return NextResponse.json({ actions: rows });
}

const Body = z.object({
  clientId: z.number(),
  platform: z.enum(OPERATOR_PLATFORM_KEYS as [string, ...string[]]),
  actionType: z.enum(["comment", "post", "reply", "dm", "review", "lead"]),
  targetUrl: z.string().url().optional(),
  resultUrl: z.string().url().optional(),
  accountId: z.number().optional(),
  note: z.string().optional(),
});

// Log an action (agent or admin). Comments count toward the daily quota meters.
export async function POST(req: NextRequest) {
  const auth = await requireUserRoute(req);
  if ("response" in auth) return auth.response;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const countsToQuota = ACTION_TYPE_MAP[b.actionType]?.countsToQuota ?? false;

  const [row] = await db
    .insert(actionLog)
    .values({
      clientId: b.clientId,
      agentId: auth.user.agentId ?? null,
      accountId: b.accountId ?? null,
      platform: b.platform,
      actionType: b.actionType,
      targetUrl: b.targetUrl ?? null,
      resultUrl: b.resultUrl ?? null,
      note: b.note ?? null,
      countsToQuota,
    })
    .returning({ id: actionLog.id });

  return NextResponse.json({ ok: true, id: row.id });
}
