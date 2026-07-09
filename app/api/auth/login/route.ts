import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/auth/password";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/auth/session";

export const dynamic = "force-dynamic";

// `scope` ties a login to a specific door: the operator login (/login) accepts
// only agents; the admin login (/admin-login) accepts only admins. Omitted =
// any role (kept for the API/CI shared-secret callers).
const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  scope: z.enum(["admin", "agent"]).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });

  const [u] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase()))
    .limit(1);

  // Constant-ish failure (don't leak which part was wrong).
  if (!u || !u.active || !(await verifyPassword(parsed.data.password, u.passwordHash))) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  // Wrong door: an admin at /login or an agent at /admin-login is rejected here,
  // so the two logins stay separate.
  if (parsed.data.scope && u.role !== parsed.data.scope) {
    const msg =
      parsed.data.scope === "admin"
        ? "This is the admin login. Operators sign in at /login."
        : "This is the operator login. Admins sign in at the admin login.";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  const token = await signSession(u.id, u.role);

  const res = NextResponse.json({
    ok: true,
    user: { id: u.id, email: u.email, name: u.name, role: u.role },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
