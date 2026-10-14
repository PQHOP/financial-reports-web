import { buildSitemapEntries } from "@/lib/sitemapEntries";

// Cached on the CDN (ISR) and regenerated at most hourly; publishes purge it
// via invalidateDbCache(). A plain Route Handler rather than the
// `app/sitemap.ts` metadata convention: see the note in
// src/lib/sitemapEntries.ts for why.
export const revalidate = 3600;

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
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
