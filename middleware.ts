import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: a fast cookie-presence gate. The real session check (DB
 * lookup, revocation, auditor expiry) happens server-side in each route
 * group's layout, which returns 403 — never a redirect loop — when the role
 * does not match (S0-2).
 */
const PUBLIC_PATHS = ["/login", "/glossary", "/design", "/api/webhooks"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const hasSession = request.cookies.has("portal_session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
