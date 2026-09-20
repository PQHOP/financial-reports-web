import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { periodLabels } from "@/lib/period";
import { metricsHeadline, readMetrics } from "@/lib/metrics";
import { SITE_NAME } from "@/lib/site";

export const alt = "Earnings report analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    include: { company: { select: { name: true, ticker: true } } },
  });

  const label = report
    ? `${report.company.ticker ?? report.company.name} · ${periodLabels[report.period]} ${report.year}`
    : SITE_NAME;
  const metrics = report ? readMetrics(report.metrics) : null;
  const headline = metrics ? metricsHeadline(metrics) : "";
  const summary = report?.summary ?? "";
  const clipped = summary.length > 170 ? `${summary.slice(0, 167)}...` : summary;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f172a",
          color: "#ffffff",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#94a3b8" }}>
          {SITE_NAME}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>
            {label}
          </div>
          {report && (
            <div style={{ display: "flex", fontSize: 34, color: "#cbd5e1" }}>
              {report.company.name} earnings analysis
            </div>
          )}
          {headline && (
            <div style={{ display: "flex", fontSize: 44, color: "#38bdf8" }}>
              {headline}
            </div>
          )}
          {clipped && (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                color: "#94a3b8",
                lineHeight: 1.35,
              }}
            >
              {clipped}
            </div>
          )}
        </div>
      </div>
    ),
    size
  );
}
