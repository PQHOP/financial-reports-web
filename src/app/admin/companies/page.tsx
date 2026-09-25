import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { deleteCompanyAction } from "@/app/admin/companies/actions";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;

  const companies = await prisma.company.findMany({
    include: {
      industries: true,
      _count: { select: { reports: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Companies</h1>
        <Link
          href="/admin/companies/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          + New company
        </Link>
      </div>

      <div className="flex gap-4 text-sm">
        <Link href="/admin" className="text-zinc-500 hover:underline">
          Reports
        </Link>
        <span className="font-medium text-zinc-900">Companies</span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {companies.length === 0 ? (
        <p className="text-zinc-500">No companies yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
                <th className="px-4 py-2 font-semibold text-zinc-700">
                  Company
                </th>
                <th className="px-4 py-2 font-semibold text-zinc-700">
                  Country / Exchange
                </th>
                <th className="px-4 py-2 font-semibold text-zinc-700">
                  Industries
                </th>
                <th className="px-4 py-2 font-semibold text-zinc-700">
                  Reports
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2">
                    <div className="font-medium">{company.name}</div>
                    <div className="text-xs text-zinc-500">
                      {company.ticker ?? "—"} · /{company.slug}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {company.country}
                    {company.exchange ? ` · ${company.exchange}` : ""}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {company.industries.map((industry) => (
                        <span
                          key={industry.id}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                        >
                          {industry.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {company._count.reports}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-3 text-sm">
                      <Link
                        href={`/companies/${company.slug}`}
                        className="text-zinc-500 hover:underline"
                      >
                        View
                      </Link>
                      <Link
                        href={`/admin/companies/${company.id}/edit`}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                      <form action={deleteCompanyAction.bind(null, company.id)}>
                        <SubmitButton className="text-red-600 hover:underline" pendingText="Deleting…">Delete</SubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
