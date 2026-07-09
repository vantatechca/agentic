import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "agent";
  agentId: number | null;
};

/** Resolve the logged-in user from the session cookie (server components). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const [u] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!u || !u.active) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, agentId: u.agentId };
}

/** Route-handler guard: returns the user, or a 401/403 NextResponse to return. */
export async function requireUserRoute(
  req: NextRequest,
  opts: { role?: "admin" } = {},
): Promise<{ user: CurrentUser } | { response: NextResponse }> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const [u] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!u || !u.active) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (opts.role === "admin" && u.role !== "admin") {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { user: { id: u.id, email: u.email, name: u.name, role: u.role, agentId: u.agentId } };
}
