import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, agents } from "@/db/schema";
import { requireAdmin } from "@/lib/adminAuth";
import { hashPassword } from "@/auth/password";

export const dynamic = "force-dynamic";

// List users (admin). Never returns password hashes.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      agentId: users.agentId,
      active: users.active,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(200);
  return NextResponse.json({ users: rows });
}

const Body = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "agent"]).default("agent"),
  assignedNiches: z.array(z.string()).optional(),
});

// Create a login user (admin). For agent role, auto-creates an operator profile.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;
  const email = b.email.toLowerCase();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return NextResponse.json({ error: "email already exists" }, { status: 409 });

  let agentId: number | null = null;
  if (b.role === "agent") {
    const [agent] = await db
      .insert(agents)
      .values({ name: b.name, assignedNiches: b.assignedNiches ?? [] })
      .returning({ id: agents.id });
    agentId = agent.id;
  }

  const [u] = await db
    .insert(users)
    .values({
      email,
      name: b.name,
      passwordHash: await hashPassword(b.password),
      role: b.role,
      agentId,
    })
    .returning({ id: users.id, email: users.email, role: users.role, agentId: users.agentId });

  return NextResponse.json({ ok: true, user: u });
}
