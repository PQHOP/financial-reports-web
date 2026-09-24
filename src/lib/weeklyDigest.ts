import { prisma } from "@/lib/prisma";
import { systemReports } from "@/lib/community";
import { periodLabels } from "@/lib/period";
import {
  formatMoneyMillions,
  formatPct,
  metricsHeadline,
  readMetrics,
  type ReportMetrics,
} from "@/lib/metrics";
import type { ReportPeriod } from "@/generated/prisma/client";

// Weekly digest: everything the site published in the last 7 days, assembled
// from our own database with no model call, so every number in it is a number
// already published in one of our reports and it costs nothing to run.

export const MIN_DIGEST_ITEMS = 3;
const MAX_TABLE_ROWS = 40;
const MAX_BLURBS = 12;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type DigestReport = {
  id: string;
  ticker: string | null;
  companyName: string;
  year: number;
  period: ReportPeriod;
  summary: string;
  metrics: unknown;
};

export type DigestBrief = {
  slug: string;
  title: string;
  summary: string;
};

export type Digest = {
  title: string;
  summary: string;
  contentMd: string;
  tickers: string[];
  reportCount: number;
  briefCount: number;
};

function shortDate(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function label(report: DigestReport): string {
  return report.ticker ?? report.companyName;
}

function cell(value: string | undefined): string {
  return value ?? "n/a";
}

function money(metrics: ReportMetrics | null): string | undefined {
  return metrics?.revenue !== undefined
    ? formatMoneyMillions(metrics.revenue, metrics.currency)
    : undefined;
}

function eps(metrics: ReportMetrics | null): string | undefined {
  if (metrics?.epsDiluted === undefined) return undefined;
  const prefix =
    metrics.currency && metrics.currency !== "USD" ? `${metrics.currency} ` : "$";
  return `${prefix}${metrics.epsDiluted.toFixed(2)}`;
}

function pct(value: number | undefined): string | undefined {
  return value === undefined ? undefined : formatPct(value);
}

// Pure (no I/O) so it can be tested without a database.
export function renderDigest(
  reports: DigestReport[],
  briefs: DigestBrief[],
  start: Date,
  end: Date
): Digest | null {
  if (reports.length + briefs.length < MIN_DIGEST_ITEMS) return null;

  const range = `${shortDate(start)} to ${shortDate(end)}, ${end.getUTCFullYear()}`;
  const link = (r: DigestReport) =>
    `[${label(r)} ${periodLabels[r.period]} ${r.year}](/reports/${r.id})`;
  const withMetrics = reports.map((r) => ({ r, m: readMetrics(r.metrics) }));

  const parts: string[] = [];
  parts.push(
    `> **This week:** ${reports.length} new earnings ${reports.length === 1 ? "analysis" : "analyses"} and ${briefs.length} market ${briefs.length === 1 ? "brief" : "briefs"} were published from ${range}. Everything below is taken from those pieces; nothing here is new reporting.`
  );

  if (reports.length > 0) {
    const rows = withMetrics.slice(0, MAX_TABLE_ROWS).map(
      ({ r, m }) =>
        `| ${link(r)} | ${cell(money(m))} | ${cell(pct(m?.revenueYoyPct))} | ${cell(eps(m))} | ${cell(pct(m?.epsYoyPct))} |`
    );
    parts.push(
      [
        "## New earnings analyses",
        "",
        "| Report | Revenue | Revenue vs. a year earlier | Diluted EPS | EPS vs. a year earlier |",
        "| --- | --- | --- | --- | --- |",
        ...rows,
      ].join("\n")
    );

    const growth = withMetrics
      .filter(({ m }) => m?.revenueYoyPct !== undefined)
      .sort((a, b) => b.m!.revenueYoyPct! - a.m!.revenueYoyPct!);
    if (growth.length >= 6) {
      const bullet = ({ r, m }: (typeof growth)[number]) =>
        `- ${link(r)}: revenue ${formatPct(m!.revenueYoyPct!)}`;
      parts.push(
        [
          "## Biggest swings in revenue",
          "",
          "Year-over-year revenue change as reported in each analysis, among this week's reports.",
          "",
          "**Fastest growth**",
          "",
          ...growth.slice(0, 3).map(bullet),
          "",
          "**Slowest growth or decline**",
          "",
          ...growth.slice(-3).reverse().map(bullet),
        ].join("\n")
      );
    }

    parts.push(
      [
        "## What the analyses found",
        "",
        ...withMetrics.slice(0, MAX_BLURBS).map(({ r, m }) => {
          const headline = m ? metricsHeadline(m) : "";
          return `- **${link(r)}**${headline ? ` (${headline})` : ""}: ${r.summary}`;
        }),
        ...(reports.length > MAX_BLURBS
          ? ["", `*Plus ${reports.length - MAX_BLURBS} more on the [latest reports](/reports) page.*`]
          : []),
      ].join("\n")
    );
  }

  if (briefs.length > 0) {
    parts.push(
      [
        "## Market briefs this week",
        "",
        ...briefs.map((b) => `- [${b.title}](/insights/${b.slug}): ${b.summary}`),
      ].join("\n")
    );
  }

  parts.push(
    "---\n\n*Assembled automatically each week from this site's own published analyses and briefs. Figures are as stated in each linked report. For information only; not investment advice.*"
  );

  const tickers = [
    ...new Set(reports.map((r) => r.ticker).filter((t): t is string => Boolean(t))),
  ];
  const named = reports.slice(0, 3).map(label).join(", ");
  return {
    title: `Weekly digest, ${range}: ${reports.length} new earnings ${reports.length === 1 ? "analysis" : "analyses"}`,
    summary: `${reports.length} new earnings ${reports.length === 1 ? "analysis" : "analyses"}${named ? ` (including ${named})` : ""} and ${briefs.length} market ${briefs.length === 1 ? "brief" : "briefs"} from ${range}.`,
    contentMd: parts.join("\n\n"),
    tickers,
    reportCount: reports.length,
    briefCount: briefs.length,
  };
}

export async function buildDigest(now: Date): Promise<Digest | null> {
  // Seven UTC calendar days ending today.
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)
  );

  const [reports, briefs] = await Promise.all([
    prisma.report.findMany({
      where: { ...systemReports, publishedAt: { gte: start } },
      orderBy: { publishedAt: "desc" },
      include: { company: { select: { name: true, ticker: true } } },
    }),
    prisma.article.findMany({
      where: { kind: "NEWS", publishedAt: { gte: start } },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, title: true, summary: true },
    }),
  ]);

  return renderDigest(
    reports.map((r) => ({
      id: r.id,
      ticker: r.company.ticker,
      companyName: r.company.name,
      year: r.year,
      period: r.period,
      summary: r.summary,
      metrics: r.metrics,
    })),
    briefs,
    start,
    now
  );
}
