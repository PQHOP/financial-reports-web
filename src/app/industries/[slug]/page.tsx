import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ReportCard } from "@/components/ReportCard";
import { systemReports } from "@/lib/community";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { periodLabels, periodOrder } from "@/lib/period";
import { reportPath } from "@/lib/reportPath";
import {
  metricsProfile,
  PROFILE_LAYOUT,
  readMetrics,
  type MetricsProfile,
} from "@/lib/metrics";
import { cleanCompanyName } from "@/lib/companyName";

export const dynamic = "force-dynamic";

const UNCATEGORIZED_SLUG = "uncategorized";
const PENDING_LIMIT = 100;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const industry = await prisma.industry.findUnique({ where: { slug } });
  if (!industry) return {};
  const reportCount = await prisma.report.count({
    where: {
      ...systemReports,
      company: { industries: { some: { id: industry.id } } },
    },
  });

  const uncategorized = industry.slug === UNCATEGORIZED_SLUG;
  const title = uncategorized
    ? "Other US-Listed Companies"
    : `${industry.name} Stocks: Earnings Reports & Analysis`;
  const description = `Plain-English earnings analysis for ${reportCount} ${
    industry.name
  } ${reportCount === 1 ? "report" : "reports"}, each built from the company's own SEC filing.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/industries/${industry.slug}`,
    },
    openGraph: { title, description },
    // The catch-all bucket has no theme to rank for; its reports are indexed
    // on their own pages.
    ...(reportCount === 0 || uncategorized
      ? { robots: { index: false, follow: true } }
      : {}),
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
        include: {
          _count: { select: { reports: { where: systemReports } } },
        },
      },
    },
  });

  if (!industry) notFound();

  const uncategorized = industry.slug === UNCATEGORIZED_SLUG;
  const [recentReports, allReports] = await Promise.all([
    prisma.report.findMany({
      where: {
        ...systemReports,
        company: { industries: { some: { id: industry.id } } },
      },
      orderBy: { publishedAt: "desc" },
      take: 12,
      include: { company: { select: { name: true, ticker: true, slug: true } } },
    }),
    // For the peer table; the catch-all bucket has no peers to compare.
    uncategorized
      ? Promise.resolve([])
      : prisma.report.findMany({
          where: {
            ...systemReports,
            company: { industries: { some: { id: industry.id } } },
          },
          select: {
            id: true,
            year: true,
            period: true,
            metrics: true,
            company: { select: { id: true, name: true, ticker: true, slug: true } },
          },
        }),
  ]);

  // Each company's most recent fiscal period with figures, fastest revenue
  // growth first.
  const rank = (r: { year: number; period: (typeof periodOrder)[number] }) =>
    r.year * 10 + periodOrder.indexOf(r.period);
  const latestByCompany = new Map<string, (typeof allReports)[number]>();
  for (const r of allReports) {
    if (!readMetrics(r.metrics)) continue;
    const current = latestByCompany.get(r.company.id);
    if (!current || rank(r) > rank(current)) latestByCompany.set(r.company.id, r);
  }
  // Banks and insurers are compared on their own figures (NIM, combined
  // ratio...), in a table of their own. A lone bank or insurer has no peer,
  // so it joins the general table instead.
  const peerRows = [...latestByCompany.values()].map((r) => ({
    report: r,
    m: readMetrics(r.metrics)!,
  }));
  const byProfile = new Map<MetricsProfile, typeof peerRows>();
  for (const row of peerRows) {
    const profile = metricsProfile(row.m);
    byProfile.set(profile, [...(byProfile.get(profile) ?? []), row]);
  }
  for (const profile of ["bank", "insurer"] as const) {
    const rows = byProfile.get(profile);
    if (rows && rows.length < 2) {
      byProfile.set("general", [...(byProfile.get("general") ?? []), ...rows]);
      byProfile.delete(profile);
    }
  }
  const peerTables = (["bank", "insurer", "general"] as const)
    .map((profile) => {
      const layout = PROFILE_LAYOUT[profile];
      const rows = (byProfile.get(profile) ?? []).sort(
        (a, b) =>
          layout.peerSort(a.m, b.m) ||
          a.report.company.name.localeCompare(b.report.company.name)
      );
      return { profile, layout, rows };
    })
    .filter((t) => t.rows.length >= 2);
  // Analyzed companies first; the long tail of un-analyzed directory entries
  // follows so the page leads with content, not a wall of empty names.
  const analyzed = industry.companies.filter((c) => c._count.reports > 0);
  const pending = industry.companies.filter((c) => c._count.reports === 0);
  // Uncategorized holds ~5,000 directory entries; rendering them all made the
  // page megabytes of empty links. Show a slice and point to search instead.
  const companies = [...analyzed, ...pending.slice(0, PENDING_LIMIT)];
  const hiddenCount = pending.length - Math.min(pending.length, PENDING_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[{ name: industry.name, href: `/industries/${industry.slug}` }]}
        />
        <h1 className="mt-2 text-2xl font-semibold">
          {uncategorized ? industry.name : `${industry.name} earnings`}
        </h1>
      </div>

      {peerTables.map(({ profile, layout, rows }) => (
        <section key={profile} className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">
            {industry.name}:{" "}
            {profile === "general" && peerTables.length > 1
              ? "other companies side by side"
              : layout.peerTitle}
          </h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Company</th>
                  <th className="px-3 py-2 font-semibold">Period</th>
                  {layout.peers.map((col) => (
                    <th key={col.label} className="px-3 py-2 text-right font-semibold">
                      {col.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ report: r, m }) => (
                  <tr key={r.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      <Link
                        href={`/companies/${r.company.slug}`}
                        className="text-blue-700 hover:underline"
                      >
                        {r.company.ticker ?? cleanCompanyName(r.company.name)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link href={reportPath(r)} className="hover:underline">
                        {periodLabels[r.period]} {r.year}
                      </Link>
                    </td>
                    {layout.peers.map((col) => (
                      <td key={col.label} className="px-3 py-2 text-right tabular-nums">
                        {col.value(m) ?? "–"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500">
            Each company&apos;s most recent period we&apos;ve analyzed,{" "}
            {layout.peerSortNote}. Periods differ between companies, so compare
            growth rates and ratios rather than absolute amounts.
            {layout.glossary ? ` ${layout.glossary}` : ""}
          </p>
        </section>
      ))}

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
                  {cleanCompanyName(company.name)}
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

      {hiddenCount > 0 && (
        <p className="text-sm text-zinc-500">
          {hiddenCount.toLocaleString("en-US")} more companies without an
          analysis yet.{" "}
          <Link href="/search" className="underline">
            Search by name or ticker
          </Link>
          .
        </p>
      )}
    </div>
  );
}
