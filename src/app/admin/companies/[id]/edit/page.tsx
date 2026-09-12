import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { AdminCompanyForm } from "@/components/AdminCompanyForm";
import { updateCompanyAction } from "@/app/admin/companies/actions";

export const dynamic = "force-dynamic";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [company, industries] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: { industries: true },
    }),
    prisma.industry.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  if (!company) notFound();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Edit company</h1>
      <AdminCompanyForm
        action={updateCompanyAction}
        allIndustryNames={industries.map((i) => i.name)}
        initialCompany={{
          id: company.id,
          slug: company.slug,
          name: company.name,
          ticker: company.ticker,
          country: company.country,
          exchange: company.exchange,
          industries: company.industries.map((i) => i.name),
        }}
      />
    </div>
  );
}
