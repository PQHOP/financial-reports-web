import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
      },
    },
  });

  if (!industry) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← Ngành nghề
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{industry.name}</h1>
      </div>

      {industry.companies.length === 0 ? (
        <p className="text-zinc-500">Chưa có công ty nào trong ngành này.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {industry.companies.map((company) => (
            <li key={company.id}>
              <Link
                href={`/cong-ty/${company.slug}`}
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
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
