import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { periodLabels, periodOrder } from "@/lib/period";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; year: string }>;
}): Promise<Metadata> {
  const { slug, year } = await params;

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return {};

  const title = `${year} Reports — ${company.name}`;
  const description = `Financial report analysis for ${company.name}${
    company.ticker ? ` (${company.ticker})` : ""
  } covering fiscal year ${year}.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/companies/${company.slug}/${year}`,
    },
    openGraph: { title, description },
  };
}

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
          href={`/companies/${company.slug}`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← {company.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {yearNum} Reports — {company.name}
        </h1>
      </div>

      {sortedReports.length === 0 ? (
        <p className="text-zinc-500">No reports for this year yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {sortedReports.map((report) => (
            <li key={report.id}>
              <Link
                href={`/reports/${report.id}`}
                className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
              >
                {report.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={report.coverImageUrl}
                    alt={report.title}
                    className="h-20 w-32 shrink-0 rounded-md object-cover"
                  />
                )}
                <div>
                  <div className="text-sm font-medium text-zinc-500">
                    {periodLabels[report.period]}
                  </div>
                  <div className="font-medium">{report.title}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                    {report.summary}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
