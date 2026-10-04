import type { NextConfig } from "next";
import { ADSENSE_CSP, ADSENSE_PUBLISHER_ID } from "./src/lib/adsense";
import { GA_CSP, GA_MEASUREMENT_ID } from "./src/lib/analytics";

// One static CSP for every response. It used to carry a per-request nonce set
// in src/proxy.ts, but a nonce forces every page to render per request; with
// pages cached on the CDN (ISR) that's gone, so script-src allows 'self' plus
// 'unsafe-inline' for Next's inline bootstrap scripts (see
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
// "Without Nonces"). Nothing on the site renders user-supplied HTML:
// community Markdown goes through ReportContent's `untrusted` mode.
// style-src needs 'unsafe-inline' regardless: Next's runtime sets inline
// style attributes (next-route-announcer).
const isDev = process.env.NODE_ENV === "development";
const ads = ADSENSE_PUBLISHER_ID ? ADSENSE_CSP : null;
const ga = GA_MEASUREMENT_ID ? GA_CSP : null;
const extra = (...lists: (string[] | undefined)[]) => {
  const hosts = lists.flatMap((l) => l ?? []);
  return hosts.length ? " " + hosts.join(" ") : "";
};
const csp = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${extra(ads?.script, ga?.script)};
  style-src 'self' 'unsafe-inline'${extra(ads?.style)};
  img-src 'self' https: data: blob:;
  font-src 'self'${extra(ads?.font)};
  connect-src 'self'${extra(ads?.connect, ga?.connect)};
  frame-src 'self'${extra(ads?.frame)};
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  // Don't advertise the framework to scanners/attackers.
  poweredByHeader: false,
  async redirects() {
    // /methodology was removed; keep old links and search results working.
    return [
      { source: "/methodology", destination: "/about", permanent: true },
      // One host for search engines: www.<domain> served the whole site as a
      // duplicate with a 200. Send it to the bare domain permanently.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www\\.(?<host>.+)" }],
        destination: "https://:host/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    // The community view of a company or year page keeps its public
    // ?source=community URL but renders from its own route, so the system
    // view never reads the query string and can be cached on the CDN.
    return {
      beforeFiles: [
        {
          source: "/companies/:slug",
          has: [{ type: "query", key: "source", value: "community" }],
          destination: "/companies/:slug/community",
        },
        {
          source: "/companies/:slug/:year(\\d{4})",
          has: [{ type: "query", key: "source", value: "community" }],
          destination: "/companies/:slug/:year/community",
        },
      ],
    };
  },
  async headers() {
    return [
      {
        // Baseline hardening on every response.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
