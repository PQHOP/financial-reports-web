import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findSystemReport } from "@/lib/reportData";
import { ReportView, reportMetadata } from "@/components/ReportView";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string; year: string; period: string }>;

// Canonical home of our own analyses, e.g. /companies/nvda/2026/q2.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const report = await findSystemReport(await params);
  return report ? reportMetadata(report) : {};
}

export default async function CanonicalReportPage({ params }: { params: Params }) {
  const report = await findSystemReport(await params);
  if (!report) notFound();
  return <ReportView report={report} />;
}
