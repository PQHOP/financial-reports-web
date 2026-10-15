import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /search is kept crawlable (not disallowed here) so Googlebot can see
      // its per-page `noindex` meta tag rather than just skipping the page.
      disallow: [
        "/admin",
        // RSC payloads for client-side navigation. Googlebot learned these
        // while <Link> still prefetched (before 2026-10-03) and by October
        // spent ~80% of its crawls refreshing them instead of HTML pages.
        "/*?_rsc=",
        "/*&_rsc=",
        // Community submission form: noindex, rendered per request, and
        // linked from every company and report page.
        "/companies/*/write",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
