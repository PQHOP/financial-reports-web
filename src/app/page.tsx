import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const industries = await prisma.industry.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { companies: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Browse by Industry</h1>
        <p className="mt-1 text-zinc-500">
          Financial report analysis for publicly listed companies, organized
          by sector.
        </p>
      </div>
      {industries.length === 0 ? (
        <p className="text-zinc-500">No industries yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {industries.map((industry) => (
            <li key={industry.id}>
              <Link
                href={`/industries/${industry.slug}`}
                className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400"
              >
                <div className="font-medium">{industry.name}</div>
                <div className="text-sm text-zinc-500">
                  {industry._count.companies} companies
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
