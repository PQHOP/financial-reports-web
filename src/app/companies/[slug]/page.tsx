import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      industries: true,
      reports: {
        select: { year: true },
        orderBy: { year: "desc" },
      },
    },
  });

  if (!company) notFound();

  const years = Array.from(new Set(company.reports.map((r) => r.year))).sort(
    (a, b) => b - a
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← Industries
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {company.name}
          {company.ticker && (
            <span className="ml-2 text-lg text-zinc-500">
              ({company.ticker})
            </span>
          )}
        </h1>
        <p className="text-sm text-zinc-500">
          {company.country}
          {company.exchange ? ` · ${company.exchange}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {company.industries.map((industry) => (
            <Link
              key={industry.id}
              href={`/industries/${industry.slug}`}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 hover:border-zinc-400"
            >
              {industry.name}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Reports by Year</h2>
        {years.length === 0 ? (
          <p className="text-zinc-500">No reports for this company yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {years.map((year) => (
              <li key={year}>
                <Link
                  href={`/companies/${company.slug}/${year}`}
                  className="block rounded-lg border border-zinc-200 bg-white px-5 py-3 hover:border-zinc-400"
                >
                  {year}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
