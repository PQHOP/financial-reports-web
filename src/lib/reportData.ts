import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { systemReports } from "@/lib/community";
import { periodFromSlug } from "@/lib/reportPath";

const reportInclude = { company: { include: { industries: true } } } as const;

// One of our own published analyses, by its canonical URL parts. Cached per
// request so generateMetadata, the page and the OG image share one query.
export const findSystemReport = cache(
  async ({ slug, year, period }: { slug: string; year: string; period: string }) => {
    const periodValue = periodFromSlug(period);
    const yearNum = Number(year);
    if (!periodValue || !Number.isInteger(yearNum)) return null;
    return prisma.report.findFirst({
      where: { ...systemReports, year: yearNum, period: periodValue, company: { slug } },
      include: reportInclude,
    });
  }
);

// Any report by id, whatever its status; callers decide who may see it.
export const findReportById = cache(async (id: string) =>
  prisma.report.findUnique({ where: { id }, include: reportInclude })
);

export type FullReport = NonNullable<Awaited<ReturnType<typeof findReportById>>>;
