import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ReportCard } from "@/components/ReportCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const industry = await prisma.industry.findUnique({ where: { slug } });
  if (!industry) return {};
  const reportCount = await prisma.report.count({
    where: { company: { industries: { some: { id: industry.id } } } },
  });

  const title = industry.name;
  const description = `Financial report analysis for publicly listed ${industry.name} companies.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/industries/${industry.slug}`,
    },
    openGraph: { title, description },
    ...(reportCount === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const industry = await prisma.industry.findUnique({
    where: { slug },
    include: {
      companies: {
        orderBy: { name: "asc" },
        include: { _count: { select: { reports: true } } },
      },
    },
  });

  if (!industry) notFound();

  const recentReports = await prisma.report.findMany({
    where: { company: { industries: { some: { id: industry.id } } } },
    orderBy: { publishedAt: "desc" },
    take: 12,
    include: { company: { select: { name: true, ticker: true } } },
  });
  // Analyzed companies first; the long tail of un-analyzed directory entries
  // follows so the page leads with content, not a wall of empty names.
  const companies = [...industry.companies].sort(
    (a, b) => Number(b._count.reports > 0) - Number(a._count.reports > 0)
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← Industries
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{industry.name}</h1>
      </div>

      {recentReports.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">
            Latest {industry.name} analyses
          </h2>
          <ul className="flex flex-col gap-3">
            {recentReports.map((report) => (
              <li key={report.id}>
                <ReportCard report={report} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="text-lg font-medium">
        Companies in {industry.name}
      </h2>

      {industry.companies.length === 0 ? (
        <p className="text-zinc-500">No companies in this industry yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {companies.map((company) => (
            <li key={company.id}>
              <Link
                href={`/companies/${company.slug}`}
                className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400"
              >
                <div className="font-medium">
                  {company.name}
                  {company.ticker && (
                    <span className="ml-2 text-sm text-zinc-500">
                      ({company.ticker})
                    </span>
                  )}
                </div>
                <div className="text-sm text-zinc-500">
                  {company.country}
                  {company.exchange ? ` · ${company.exchange}` : ""}
                  {company._count.reports > 0
                    ? ` · ${company._count.reports} ${company._count.reports === 1 ? "analysis" : "analyses"}`
                    : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
