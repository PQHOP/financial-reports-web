import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CommunityReportForm } from "@/components/CommunityReportForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return {};
  return {
    title: `Write a report on ${company.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function WriteReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, ticker: true },
  });
  if (!company) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/companies/${company.slug}`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← {company.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          Write a report on {company.name}
          {company.ticker && (
            <span className="ml-2 text-lg text-zinc-500">({company.ticker})</span>
          )}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Share your own reading of this company&apos;s financial results. Your
          name appears on the report; your email stays private and is only used
          if we need to contact you.
        </p>
      </div>
      <CommunityReportForm
        company={{ id: company.id, slug: company.slug, name: company.name }}
      />
    </div>
  );
}
