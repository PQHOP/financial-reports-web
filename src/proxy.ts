import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/adminCookie";

// Optimistic check only: confirms a session cookie is present so we can
// redirect anonymous visitors to the login page. The real, signature-verified
// check happens in each admin page and Server Action via getIsAdmin().
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has(ADMIN_COOKIE_NAME);
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
