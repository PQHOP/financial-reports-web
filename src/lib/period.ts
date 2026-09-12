import { ReportPeriod } from "@/generated/prisma/client";

export const periodLabels: Record<ReportPeriod, string> = {
  Q1: "Q1",
  Q2: "Q2",
  Q3: "Q3",
  Q4: "Q4",
  H1: "H1 (Interim)",
  ANNUAL: "Full Year",
};

export const periodOrder: ReportPeriod[] = [
  "Q1",
  "Q2",
  "H1",
  "Q3",
  "Q4",
  "ANNUAL",
];
