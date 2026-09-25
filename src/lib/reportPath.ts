import type { ReportPeriod } from "@/generated/prisma/client";
import { SITE_URL } from "@/lib/site";

// Our own analyses live at /companies/<company>/<year>/<period> (e.g.
// /companies/nvda/2026/q2): the URL carries the words people search for, and
// there is exactly one system report per company/year/period. Community
// reports can share a period, so they keep /reports/<id>. /reports/<id>
// still works for system reports too: it 308s here for visitors (and renders
// in place for the admin, which scripts/admin-publish.ts relies on).
const PERIOD_SLUGS: Record<ReportPeriod, string> = {
  Q1: "q1",
  Q2: "q2",
  Q3: "q3",
  Q4: "q4",
  H1: "h1",
  ANNUAL: "annual",
};

export function periodFromSlug(slug: string): ReportPeriod | null {
  const match = Object.entries(PERIOD_SLUGS).find(([, s]) => s === slug);
  return match ? (match[0] as ReportPeriod) : null;
}

export type ReportPathInput = {
  id: string;
  year: number;
  period: ReportPeriod;
  origin?: "ADMIN" | "COMMUNITY";
  company: { slug: string };
};

export function reportPath(report: ReportPathInput): string {
  if (report.origin === "COMMUNITY") return `/reports/${report.id}`;
  return `/companies/${report.company.slug}/${report.year}/${PERIOD_SLUGS[report.period]}`;
}

export function reportUrl(report: ReportPathInput): string {
  return `${SITE_URL}${reportPath(report)}`;
}
