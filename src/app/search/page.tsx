import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  robots: {
    index: false,
    follow: true,
  },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const companies = query
    ? await prisma.company.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { ticker: { contains: query, mode: "insensitive" } },
          ],
        },
        include: { industries: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        Search results{query ? ` for "${query}"` : ""}
      </h1>

      {!query ? (
        <p className="text-zinc-500">
          Enter a company name or ticker to search.
        </p>
      ) : companies.length === 0 ? (
        <p className="text-zinc-500">No matching companies found.</p>
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
                  {company.industries.map((i) => i.name).join(", ")} ·{" "}
                  {company.country}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
