import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { periodLabels } from "@/lib/period";

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
      images: { orderBy: { order: "asc" } },
    },
  });

  if (!report) notFound();

  return (
    <article className="flex flex-col gap-6">
      <div>
        <Link
          href={`/cong-ty/${report.company.slug}/${report.year}`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← {report.company.name} · {report.year}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{report.title}</h1>
        <p className="text-sm text-zinc-500">
          {periodLabels[report.period]} · Năm {report.year} · Đăng bởi{" "}
          {report.author} ·{" "}
          {new Date(report.publishedAt).toLocaleDateString("vi-VN")}
        </p>
      </div>

      <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-5 leading-relaxed">
        {report.contentMd}
      </div>

      {report.images.length > 0 && (
        <div className="flex flex-col gap-4">
          {report.images.map((image) => (
            <figure key={image.id}>
              <Image
                src={image.url}
                alt={image.caption ?? report.title}
                width={800}
                height={400}
                className="w-full rounded-lg border border-zinc-200"
                unoptimized
              />
              {image.caption && (
                <figcaption className="mt-1 text-center text-sm text-zinc-500">
                  {image.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </article>
  );
}
