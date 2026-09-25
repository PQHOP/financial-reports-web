import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ReportCard } from "@/components/ReportCard";
import { systemReports } from "@/lib/community";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export const metadata: Metadata = {
  title: "Latest earnings report analyses",
  description:
    "The most recent earnings report analyses, newest first: revenue, profit, what drove the results, and what management expects next.",
  alternates: { canonical: "/reports" },
};

export default async function ReportsIndex({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const [total, reports] = await Promise.all([
    prisma.report.count({ where: systemReports }),
    prisma.report.findMany({
      where: systemReports,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { company: { select: { name: true, ticker: true, slug: true } } },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Latest reports</h1>
        <p className="mt-1 text-zinc-500">
          {total} analyses, newest first.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {reports.map((report) => (
          <li key={report.id}>
            <ReportCard report={report} />
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav className="flex justify-between text-sm">
          {page > 1 ? (
            <Link href={`/reports?page=${page - 1}`} className="hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/reports?page=${page + 1}`} className="hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
