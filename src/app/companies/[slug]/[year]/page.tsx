import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { periodLabels, periodOrder } from "@/lib/period";
import { realCoverImage } from "@/lib/reportMeta";
import { parseSource, sourceWhere, systemReports } from "@/lib/community";
import { reportPath } from "@/lib/reportPath";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; year: string }>;
}): Promise<Metadata> {
  const { slug, year } = await params;

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return {};
  const reportCount = await prisma.report.count({
    where: { companyId: company.id, year: Number(year) || 0, ...systemReports },
  });

  const title = `${company.name}${company.ticker ? ` (${company.ticker})` : ""} ${year} Earnings Reports`;
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
    ...(reportCount === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CompanyYearPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; year: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { slug, year } = await params;
  const source = parseSource((await searchParams).source);
  const yearNum = Number(year);

  const company = await prisma.company.findUnique({
    where: { slug },
  });

  if (!company || Number.isNaN(yearNum)) notFound();

  const reports = await prisma.report.findMany({
    where: { companyId: company.id, year: yearNum, ...sourceWhere(source) },
  });

  const sortedReports = [...reports].sort(
    (a, b) => periodOrder.indexOf(a.period) - periodOrder.indexOf(b.period)
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { name: company.name, href: `/companies/${company.slug}` },
            { name: String(yearNum), href: `/companies/${company.slug}/${yearNum}` },
          ]}
        />
        <h1 className="mt-1 text-2xl font-semibold">
          {yearNum} {source === "community" ? "Community " : ""}Reports —{" "}
          {company.name}
        </h1>
      </div>

      {sortedReports.length === 0 ? (
        <p className="text-zinc-500">No reports for this year yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {sortedReports.map((report) => (
            <li key={report.id}>
              <Link
                href={reportPath({ ...report, company })}
                className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
              >
                {realCoverImage(report.coverImageUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={realCoverImage(report.coverImageUrl) ?? ""}
                    alt={report.title}
                    className="h-20 w-32 shrink-0 rounded-md object-cover"
                  />
                )}
                <div>
                  <div className="text-sm font-medium text-zinc-500">
                    {periodLabels[report.period]}
                    {source === "community" && ` · by ${report.author}`}
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
