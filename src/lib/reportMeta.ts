import type { ReportPeriod } from "@/generated/prisma/client";
import { formatMoneyMillions, formatPct, type ReportMetrics } from "@/lib/metrics";
import { cleanCompanyName } from "@/lib/companyName";

// Cover images from placehold.co are fake-chart placeholders (see CLAUDE.md:
// text only, no placeholder charts). Treat them as "no cover image" so they
// never render on the page or override the generated social card.
export function realCoverImage(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.endsWith("placehold.co") ? null : url;
  } catch {
    return null;
  }
}

// Reports published before 2026-10-25 carry a generic stored title ("NVDA — Q2
// 2026 Financial Report Analysis"); newer ones state the finding. The page H1
// and the Article headline use the finding either way.
const GENERIC_TITLE = /financial report analysis\s*$/i;
const HEADLINE_MAX = 150;
const MIN_LEAD = 50;

export function isGenericTitle(title: string): boolean {
  return GENERIC_TITLE.test(title);
}

// The summary's first clause, which is written as "what happened and why":
// "Tesla's Q3 2026 revenue was flat at $28.05 billion and EPS fell 44% to
// $0.22 as R&D rose 69%; the 10-Q shows..." → everything before the ";".
export function leadClause(summary: string): string {
  const s = summary.trim();
  const semi = s.indexOf(";");
  let lead = semi >= MIN_LEAD ? s.slice(0, semi) : s;
  if (lead.length > HEADLINE_MAX) {
    const window = lead.slice(0, HEADLINE_MAX);
    const sentence = window.lastIndexOf(". ");
    if (sentence >= MIN_LEAD) lead = window.slice(0, sentence);
    else lead = `${window.slice(0, window.lastIndexOf(" "))}…`;
  }
  return lead.replace(/[.,;:\s]+$/, "");
}

export function reportHeadline(report: { title: string; summary: string }): string {
  if (!isGenericTitle(report.title)) return report.title;
  return leadClause(report.summary) || report.title;
}

// Search-result title built from what people actually type ("nvidia earnings
// q2 2026") plus the headline figure, which is what earns the click. The stored
// report.title stays off the <title>: the figures are what earn the click.
export function reportSearchTitle(
  company: { name: string; ticker: string | null },
  year: number,
  period: ReportPeriod,
  metrics: ReportMetrics | null
): string {
  const who = company.ticker ? `${cleanCompanyName(company.name)} (${company.ticker})` : cleanCompanyName(company.name);
  const when = period === "ANNUAL" ? `FY${year}` : `${period} ${year}`;
  const base = `${who} ${when} Earnings`;
  if (metrics?.revenue === undefined) return `${base} Analysis`;
  const growth =
    metrics.revenueYoyPct !== undefined ? ` (${formatPct(metrics.revenueYoyPct)})` : "";
  return `${base}: Revenue ${formatMoneyMillions(metrics.revenue, metrics.currency)}${growth}`;
}
