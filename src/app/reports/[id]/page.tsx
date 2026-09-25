import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/adminAuth";
import { findReportById } from "@/lib/reportData";
import { reportPath } from "@/lib/reportPath";
import { ReportView, reportMetadata } from "@/components/ReportView";

export const dynamic = "force-dynamic";

// Community reports live here. Our own analyses moved to
// /companies/<slug>/<year>/<period>: visitors and crawlers get a 308 there,
// while the signed-in admin sees the report in place, because
// scripts/admin-publish.ts (and the nightly routine behind it) waits for
// /reports/<id> after submitting the form. No loading.tsx in this segment:
// streaming would send a 200 before the redirect could be issued.
async function getReport(id: string) {
  const report = await findReportById(id);
  if (!report) return null;
  const isAdmin = await getIsAdmin();
  // A PENDING community submission is only visible to the admin reviewing it.
  if (report.status !== "PUBLISHED" && !isAdmin) return null;
  return { report, isAdmin };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const found = await getReport((await params).id);
  return found ? reportMetadata(found.report) : {};
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const found = await getReport((await params).id);
  if (!found) notFound();
  const { report, isAdmin } = found;
  if (report.origin === "ADMIN" && report.status === "PUBLISHED" && !isAdmin) {
    permanentRedirect(reportPath(report));
  }
  return <ReportView report={report} />;
}
