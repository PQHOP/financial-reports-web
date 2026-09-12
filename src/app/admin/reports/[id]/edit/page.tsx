import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getIsAdmin } from "@/lib/adminAuth";
import { AdminReportForm } from "@/components/AdminReportForm";
import { updateReportAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getIsAdmin())) {
    redirect("/admin/login");
  }

  const { id } = await params;

  const [report, companies] = await Promise.all([
    prisma.report.findUnique({ where: { id } }),
    prisma.company.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, ticker: true },
    }),
  ]);

  if (!report) notFound();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Edit report</h1>
      <AdminReportForm
        companies={companies}
        action={updateReportAction}
        initialReport={{
          id: report.id,
          companyId: report.companyId,
          year: report.year,
          period: report.period,
          title: report.title,
          summary: report.summary,
          contentMd: report.contentMd,
          coverImageUrl: report.coverImageUrl,
        }}
      />
    </div>
  );
}
