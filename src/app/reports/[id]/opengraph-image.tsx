import { prisma } from "@/lib/prisma";
import { ogSize, reportOgImage } from "@/lib/reportOgImage";

export const alt = "Earnings report analysis";
export const size = ogSize;
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Pending submissions must not leak through their social card either.
  const report = await prisma.report.findFirst({
    where: { id, status: "PUBLISHED" },
    include: { company: { select: { name: true, ticker: true } } },
  });
  return reportOgImage(report);
}
