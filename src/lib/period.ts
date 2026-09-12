import { ReportPeriod } from "@/generated/prisma/client";

export const periodLabels: Record<ReportPeriod, string> = {
  Q1: "Quý 1",
  Q2: "Quý 2",
  Q3: "Quý 3",
  Q4: "Quý 4",
  H1: "Giữa kỳ (6 tháng đầu năm)",
  ANNUAL: "Cả năm",
};

export const periodOrder: ReportPeriod[] = [
  "Q1",
  "Q2",
  "H1",
  "Q3",
  "Q4",
  "ANNUAL",
];
