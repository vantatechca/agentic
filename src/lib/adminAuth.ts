import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

/**
 * Minimal shared-secret gate for mutating/admin API routes (P1 placeholder,
 * replace with real auth later). Accepts `Authorization: Bearer <token>` or
 * `x-admin-token: <token>` matching ADMIN_API_TOKEN.
 *
 * Returns a NextResponse (401) when unauthorized, or null when the request may
 * proceed. In development with the default token, access is allowed but warned.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
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
    // dev convenience: allow but do not require a token
    return null;
  }

  if (provided !== env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
