import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { AdminCompanyForm } from "@/components/AdminCompanyForm";
import { createCompanyAction } from "@/app/admin/companies/actions";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage() {
  await requireAdmin();

  const industries = await prisma.industry.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">New company</h1>
      <AdminCompanyForm
        action={createCompanyAction}
        allIndustryNames={industries.map((i) => i.name)}
      />
    </div>
  );
}
