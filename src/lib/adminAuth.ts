import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { SESSION_COOKIE, verifySession } from "@/auth/session";

/**
 * Admin gate for mutating/admin API routes. Accepts EITHER:
 *   - a valid admin **session** cookie (the real login, P5), or
 *   - the `x-admin-token` / `Authorization: Bearer` shared secret (legacy/CI).
 *
 * Returns a NextResponse (401/403/503) when unauthorized, or null to proceed.
 * Async because session verification is async (HMAC).
 */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  // 1) Session cookie with admin role
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    return session.role === "admin"
      ? null
      : NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 2) Shared-secret fallback
  const provided =
    req.headers.get("x-admin-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  if (env.ADMIN_API_TOKEN === "change-me-in-prod") {
    if (env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "ADMIN_API_TOKEN is unset (default). Refusing admin action in production." },
        { status: 503 },
      );
    }
    return null; // dev convenience
  }

  if (provided !== env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
