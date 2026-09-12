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
      industry: true,
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
        <Link
          href={`/nganh/${company.industry.slug}`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← {company.industry.name}
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
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Báo cáo theo năm</h2>
        {years.length === 0 ? (
          <p className="text-zinc-500">Chưa có báo cáo nào cho công ty này.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {years.map((year) => (
              <li key={year}>
                <Link
                  href={`/cong-ty/${company.slug}/${year}`}
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
