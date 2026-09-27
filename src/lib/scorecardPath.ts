import type { ReportPeriod } from "@/generated/prisma/client";

export function scorecardPath(year: number, period: ReportPeriod): string {
  return `/scorecards/${year}/${period.toLowerCase()}`;
}
