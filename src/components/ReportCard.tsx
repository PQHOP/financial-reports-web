import Link from "next/link";
import { periodLabels } from "@/lib/period";
import { metricsHeadline, readMetrics } from "@/lib/metrics";
import type { ReportPeriod } from "@/generated/prisma/client";

export type ReportCardData = {
  id: string;
  title: string;
  summary: string;
  year: number;
  period: ReportPeriod;
  publishedAt: Date;
  metrics: unknown;
  origin?: "ADMIN" | "COMMUNITY";
  author?: string;
  company: { name: string; ticker: string | null };
};

export function ReportCard({ report }: { report: ReportCardData }) {
  const metrics = readMetrics(report.metrics);
  const headline = metrics ? metricsHeadline(metrics) : "";
  const isCommunity = report.origin === "COMMUNITY";

  return (
    <Link
      href={`/reports/${report.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
    >
      <div className="font-medium">
        {report.company.name}
        {report.company.ticker ? ` (${report.company.ticker})` : ""} ·{" "}
        {periodLabels[report.period]} {report.year}
        {isCommunity && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-900">
            Community{report.author ? ` · ${report.author}` : ""}
          </span>
        )}
      </div>
      {/* Our titles ("NVDA — Q2 2026 Financial Report Analysis") repeat the
          line above; a visitor's own title is the only one worth showing. */}
      {isCommunity && <div className="mt-1 text-sm font-medium">{report.title}</div>}
      {headline && (
        <div className="mt-1 text-sm font-medium text-zinc-900">{headline}</div>
      )}
      <p className="mt-1 line-clamp-3 text-sm text-zinc-600">{report.summary}</p>
    </Link>
  );
}
