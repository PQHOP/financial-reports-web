import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { periodLabels } from "@/lib/period";
import { ReportContent } from "@/components/ReportContent";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      company: { include: { industry: true } },
    },
  });

  if (!report) notFound();

  return (
    <article className="flex flex-col gap-6">
      <div>
        <Link
          href={`/companies/${report.company.slug}/${report.year}`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← {report.company.name} · {report.year}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold leading-tight">
          {report.title}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {periodLabels[report.period]} · Fiscal year {report.year} ·
          Published {new Date(report.publishedAt).toLocaleDateString("en-US")}{" "}
          by {report.author}
        </p>
        <p className="mt-3 text-base text-zinc-700">{report.summary}</p>
      </div>

      {report.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={report.coverImageUrl}
          alt=""
          className="w-full rounded-lg border border-zinc-200"
        />
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <ReportContent markdown={report.contentMd} />
      </div>
    </article>
  );
}
