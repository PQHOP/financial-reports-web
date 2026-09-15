import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/adminCookie";

// Runs on every page request (not just /admin) so it can hand out a fresh
// per-request CSP nonce — see src/app/reports/[id]/page.tsx for the one
// hand-authored <script> tag that reads it back via headers(). Every page
// here is already `force-dynamic` (see CLAUDE.md Stack notes), so the
// "nonces require dynamic rendering" tradeoff documented in
// node_modules/next/dist/docs/.../content-security-policy.md costs nothing
// extra — there was no static/ISR caching to lose.
//
// style-src deliberately has no nonce: a nonce only covers <style> tags,
// not inline style="..." attributes, and Next.js's own runtime (e.g.
// next-route-announcer) sets inline style attributes in every build, dev
// and prod alike — a nonce'd style-src would permanently break those.
// With no nonce token present in style-src, 'unsafe-inline' there is
// honored normally by the CSP spec. Script injection is the
// higher-severity risk and stays strictly nonce-gated; nothing in this
// app accepts user-supplied CSS.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === "development";

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' https: data: blob:;
    font-src 'self';
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `;
  const csp = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // Optimistic check only: confirms a session cookie is present so we can
  // redirect anonymous visitors to the login page. The real, signature-verified
  // check happens in each admin page and Server Action via getIsAdmin().
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!request.cookies.has(ADMIN_COOKIE_NAME)) {
      const response = NextResponse.redirect(new URL("/admin/login", request.url));
      response.headers.set("Content-Security-Policy", csp);
      return response;
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
