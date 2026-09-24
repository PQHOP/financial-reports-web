import type { Prisma } from "@/generated/prisma/client";

// Reports written by us. The default view everywhere, and the only reports
// that feed the home page, sitemap, feed, newsletter, social cron and
// scorecards. Every public listing must filter with one of these two objects
// so a PENDING community submission can never leak.
export const systemReports = {
  origin: "ADMIN",
  status: "PUBLISHED",
} satisfies Prisma.ReportWhereInput;

export const communityReports = {
  origin: "COMMUNITY",
  status: "PUBLISHED",
} satisfies Prisma.ReportWhereInput;

export type ReportSource = "system" | "community";

// `?source=community` on company / year pages; anything else is the system view.
export function parseSource(value: string | undefined): ReportSource {
  return value === "community" ? "community" : "system";
}

export function sourceWhere(source: ReportSource) {
  return source === "community" ? communityReports : systemReports;
}

// Set COMMUNITY_AUTO_PUBLISH=true to skip the admin approval queue.
export const COMMUNITY_AUTO_PUBLISH = process.env.COMMUNITY_AUTO_PUBLISH === "true";

export const COMMUNITY_LIMITS = {
  name: 80,
  email: 200,
  title: 150,
  summary: 300,
  contentMin: 300,
  contentMax: 20000,
  sourceUrl: 500,
  // Per email and per IP, rolling 24h.
  perEmailPerDay: 3,
  perIpPerDay: 5,
} as const;
