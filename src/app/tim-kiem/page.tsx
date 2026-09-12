import Link from "next/link";
import { prisma } from "@/lib/prisma";

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
            { name: { contains: query } },
            { ticker: { contains: query } },
          ],
        },
        include: { industry: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        Kết quả tìm kiếm{query ? ` cho "${query}"` : ""}
      </h1>

      {!query ? (
        <p className="text-zinc-500">Nhập tên hoặc mã công ty để tìm kiếm.</p>
      ) : companies.length === 0 ? (
        <p className="text-zinc-500">Không tìm thấy công ty phù hợp.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {companies.map((company) => (
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
                  {company.industry.name} · {company.country}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
