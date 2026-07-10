import { NextRequest, NextResponse } from "next/server";

/**
 * Auth wall (P5) — coarse gate only.
 *
 * The middleware runs on the Edge runtime, where env-var propagation (and thus
 * the HMAC secret) is unreliable across build/runtime. Verifying the session
 * signature here risks disagreeing with the Node runtime and causing an infinite
 * redirect loop. So the middleware only checks whether a session cookie is
 * PRESENT and routes unauthenticated visitors to the right login. The real
 * cryptographic verification + user lookup happens in Node — every server
 * component (getCurrentUser) and every API route (requireUserRoute/requireAdmin)
 * verifies the signature, so a bare/forged cookie grants nothing.
 *
 * Logins: operators at /login, admins at /admin-login. An unauthenticated visit
 * to an /admin* page is sent to /admin-login; everyone else to /login.
 */
const SESSION_COOKIE = "agentic_session";
const PUBLIC_PATHS = ["/login", "/admin-login", "/api/auth/login", "/api/inngest"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (hasCookie) return NextResponse.next();

  // No session cookie at all → send to the appropriate login (pages) or 401 (api).
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
