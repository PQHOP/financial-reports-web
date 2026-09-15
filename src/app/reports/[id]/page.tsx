import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { periodLabels } from "@/lib/period";
import { ReportContent } from "@/components/ReportContent";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

async function getReport(id: string) {
  return prisma.report.findUnique({
    where: { id },
    include: {
      company: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) return {};

  const description = report.summary;
  const url = `${SITE_URL}/reports/${report.id}`;

  return {
    title: report.title,
    description,
    alternates: {
      canonical: `/reports/${report.id}`,
    },
    openGraph: {
      type: "article",
      title: report.title,
      description,
      url,
      publishedTime: new Date(report.publishedAt).toISOString(),
      authors: [report.author],
      images: report.coverImageUrl ? [report.coverImageUrl] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: report.title,
      description,
      images: report.coverImageUrl ? [report.coverImageUrl] : undefined,
    },
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [report, nonce] = await Promise.all([
    getReport(id),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  if (!report) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: report.title,
    description: report.summary,
    datePublished: new Date(report.publishedAt).toISOString(),
    author: {
      "@type": "Person",
      name: report.author,
    },
    ...(report.coverImageUrl ? { image: [report.coverImageUrl] } : {}),
    about: {
      "@type": "Corporation",
      name: report.company.name,
      ...(report.company.ticker ? { tickerSymbol: report.company.ticker } : {}),
    },
    mainEntityOfPage: `${SITE_URL}/reports/${report.id}`,
  };

  return (
    <article className="flex flex-col gap-6">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
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
          alt={report.title}
          className="w-full rounded-lg border border-zinc-200"
        />
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <ReportContent markdown={report.contentMd} />
      </div>
    </article>
  );
}
