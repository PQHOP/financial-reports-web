import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { periodLabels, periodOrder } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function CompanyYearPage({
  params,
}: {
  params: Promise<{ slug: string; year: string }>;
}) {
  const { slug, year } = await params;
  const yearNum = Number(year);

  const company = await prisma.company.findUnique({
    where: { slug },
  });

  if (!company || Number.isNaN(yearNum)) notFound();

  const reports = await prisma.report.findMany({
    where: { companyId: company.id, year: yearNum },
  });

  const sortedReports = [...reports].sort(
    (a, b) => periodOrder.indexOf(a.period) - periodOrder.indexOf(b.period)
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/cong-ty/${company.slug}`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← {company.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          Báo cáo năm {yearNum} - {company.name}
        </h1>
      </div>

      {sortedReports.length === 0 ? (
        <p className="text-zinc-500">Chưa có báo cáo nào cho năm này.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sortedReports.map((report) => (
            <li key={report.id}>
              <Link
                href={`/bao-cao/${report.id}`}
                className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400"
              >
                <div className="text-sm font-medium text-zinc-500">
                  {periodLabels[report.period]}
                </div>
                <div className="font-medium">{report.title}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
