export const SITE_URL = (
  process.env.SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "Financial Report Insights";

// Byline for our own analyses (Report.author still stores the drafting model
// for the record). The methodology page explains how the reports are produced.
export const EDITORIAL_AUTHOR = "Pham Hop";

export function reportByline(report: { origin: string; author: string }): string {
  return report.origin === "COMMUNITY" ? report.author : EDITORIAL_AUTHOR;
}
