import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { prisma } from "@/lib/prisma";
import { periodLabels } from "@/lib/period";
import { requireAdmin } from "@/lib/adminAuth";
import {
  logoutAction,
  deleteReportAction,
  approveReportAction,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();

  const reports = await prisma.report.findMany({
    include: { company: true },
    orderBy: { publishedAt: "desc" },
  });

  const pending = reports.filter((r) => r.status === "PENDING");
  const others = reports.filter((r) => r.status !== "PENDING");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <form action={logoutAction}>
          <SubmitButton className="text-sm text-zinc-500 hover:underline" pendingText="Signing out…">Sign out</SubmitButton>
        </form>
      </div>

      <div className="flex gap-4 text-sm">
        <span className="font-medium text-zinc-900">Reports</span>
        <Link href="/admin/companies" className="text-zinc-500 hover:underline">
          Companies
        </Link>
        <Link href="/admin/articles/new" className="text-zinc-500 hover:underline">
          New article
        </Link>
        <Link href="/admin/newsletter" className="text-zinc-500 hover:underline">
          Newsletter draft
        </Link>
      </div>

      <Link
        href="/admin/reports/new"
        className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
      >
        + New report
      </Link>

      {pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">
            Community submissions awaiting review ({pending.length})
          </h2>
          <ul className="flex flex-col gap-3">
            {pending.map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3"
              >
                <div>
                  <div className="text-sm text-zinc-500">
                    {report.company.name} · {periodLabels[report.period]}{" "}
                    {report.year}
                  </div>
                  <div className="font-medium">{report.title}</div>
                  <div className="text-sm text-zinc-600">
                    {report.author} &lt;{report.authorEmail}&gt;
                  </div>
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  <Link
                    href={`/reports/${report.id}`}
                    className="text-zinc-500 hover:underline"
                  >
                    Preview
                  </Link>
                  <form action={approveReportAction.bind(null, report.id)}>
                    <SubmitButton className="text-green-700 hover:underline" pendingText="Approving…">Approve</SubmitButton>
                  </form>
                  <form action={deleteReportAction.bind(null, report.id)}>
                    <SubmitButton className="text-red-600 hover:underline" pendingText="Rejecting…">Reject</SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length === 0 ? (
        <p className="text-zinc-500">No reports yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {others.map((report) => (
            <li
              key={report.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3"
            >
              <div>
                <div className="text-sm text-zinc-500">
                  {report.company.name} · {periodLabels[report.period]}{" "}
                  {report.year}
                </div>
                <div className="font-medium">{report.title}</div>
                {report.origin === "COMMUNITY" && (
                  <div className="text-sm text-zinc-600">
                    Community · {report.author} &lt;{report.authorEmail}&gt;
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-3 text-sm">
                <Link
                  href={`/reports/${report.id}`}
                  className="text-zinc-500 hover:underline"
                >
                  View
                </Link>
                <Link
                  href={`/admin/reports/${report.id}/edit`}
                  className="text-blue-600 hover:underline"
                >
                  Edit
                </Link>
                <form action={deleteReportAction.bind(null, report.id)}>
                  <SubmitButton className="text-red-600 hover:underline" pendingText="Deleting…">Delete</SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
