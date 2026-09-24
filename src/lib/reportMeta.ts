import type { ReportPeriod } from "@/generated/prisma/client";
import { formatMoneyMillions, formatPct, type ReportMetrics } from "@/lib/metrics";

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

// Search-result title built from what people actually type ("nvidia earnings
// q2 2026") plus the headline figure, which is what earns the click. The stored
// report.title ("NVDA — Q2 2026 Financial Report Analysis") stays as the H1.
export function reportSearchTitle(
  company: { name: string; ticker: string | null },
  year: number,
  period: ReportPeriod,
  metrics: ReportMetrics | null
): string {
  const who = company.ticker ? `${company.name} (${company.ticker})` : company.name;
  const when = period === "ANNUAL" ? `FY${year}` : `${period} ${year}`;
  const base = `${who} ${when} Earnings`;
  if (metrics?.revenue === undefined) return `${base} Analysis`;
  const growth =
    metrics.revenueYoyPct !== undefined ? ` (${formatPct(metrics.revenueYoyPct)})` : "";
  return `${base}: Revenue ${formatMoneyMillions(metrics.revenue, metrics.currency)}${growth}`;
}
