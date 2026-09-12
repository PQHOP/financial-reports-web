import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getIsAdmin } from "@/lib/adminAuth";
import { AdminReportForm } from "@/components/AdminReportForm";
import { createReportAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function NewReportPage() {
  if (!(await getIsAdmin())) {
    redirect("/admin/login");
  }

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, ticker: true },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">New report</h1>
      <AdminReportForm companies={companies} action={createReportAction} />
    </div>
  );
}
