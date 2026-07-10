import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/auth/session";

/**
 * Auth wall (P5). Every page and API route requires a valid session, except:
 *   - /login, /admin-login, /api/auth/*   (the two login flows)
 *   - /api/inngest                         (called by Inngest Cloud, own signing)
 *   - Next internals / static assets
 *
 * Two separate logins: operators at /login, admins at /admin-login. An
 * unauthenticated visitor to an /admin* page is sent to /admin-login; everyone
 * else to /login. Runs on the edge; session verification uses Web Crypto.
 */
const PUBLIC_PATHS = ["/login", "/admin-login", "/api/auth/login", "/api/inngest"];

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
  url.pathname = pathname.startsWith("/admin") ? "/admin-login" : "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and common static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
