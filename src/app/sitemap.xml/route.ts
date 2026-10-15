import { buildSitemapEntries } from "@/lib/sitemapEntries";

// Rendered per request (bounded by the CDN cache below), NOT ISR. With ISR
// the sitemap is only ever visited a couple of times a day (Googlebot once,
// the ops health check once), and the first visit after the entry expired
// or was purged by invalidateDbCache() is served the *previous* copy while
// a new one is generated in the background (stale-while-revalidate). Every
// visit therefore got the copy made at the visit before it: on 2026-10-15
// Google's daily download was the build-time copy, missing all 40 reports
// published that night. `s-maxage` without stale-while-revalidate makes the
// CDN refetch synchronously once it expires, so a sitemap is never older
// than 10 minutes and generation costs at most ~6 function runs per hour
// per region. The exception to the "no force-dynamic" rule in CLAUDE.md is
// deliberate and documented there.
export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function GET() {
  const entries = await buildSitemapEntries();
  const body = entries
    .map((entry) => {
      const fields = [`<loc>${escapeXml(entry.url)}</loc>`];
      if (entry.lastModified) fields.push(`<lastmod>${toIso(entry.lastModified)}</lastmod>`);
      if (entry.changeFrequency) fields.push(`<changefreq>${entry.changeFrequency}</changefreq>`);
      if (entry.priority !== undefined) fields.push(`<priority>${entry.priority}</priority>`);
      return `<url>\n${fields.join("\n")}\n</url>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, must-revalidate",
      "X-Sitemap-Generated": new Date().toISOString(),
    },
  });
}
