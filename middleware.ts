import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/auth/session";

/**
 * Auth wall (P5). Every page and API route requires a valid session, except:
 *   - /login and /api/auth/*      (the login flow itself)
 *   - /api/inngest                (called by Inngest Cloud with its own signing)
 *   - Next internals / static assets
 *
 * Runs on the edge; session verification uses Web Crypto (see auth/session.ts).
 * Role-based visibility (admin vs agent) is enforced in the pages/routes.
 */
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/inngest"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (session) return NextResponse.next();

  // Unauthenticated
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and common static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
