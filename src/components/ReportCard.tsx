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
  company: { name: string; ticker: string | null };
};

export function ReportCard({ report }: { report: ReportCardData }) {
  const metrics = readMetrics(report.metrics);
  const headline = metrics ? metricsHeadline(metrics) : "";

  return (
    <Link
      href={`/reports/${report.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
    >
      <div className="text-sm font-medium text-zinc-500">
        {report.company.name}
        {report.company.ticker ? ` (${report.company.ticker})` : ""} ·{" "}
        {periodLabels[report.period]} {report.year}
      </div>
      <div className="mt-1 font-medium">{report.title}</div>
      {headline && <div className="mt-1 text-sm text-zinc-700">{headline}</div>}
      <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{report.summary}</p>
    </Link>
  );
}
