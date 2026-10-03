import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/adminCookie";

// Admin only. Public pages are served from the CDN cache, so anything that
// used to run here on every request now lives in next.config.ts instead: the
// CSP header (no per-request nonce, which would force dynamic rendering) and
// the www -> bare domain redirect.
//
// Optimistic check only: confirms a session cookie is present so we can
// redirect anonymous visitors to the login page. The real, signature-verified
// check happens in each admin page and Server Action via getIsAdmin().
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/admin/login" && !request.cookies.has(ADMIN_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
