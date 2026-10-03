import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prismaCached as prisma } from "@/lib/prisma";
import { ArticleView } from "@/components/ArticleView";

// Cached on the CDN (ISR); publishes purge it via invalidateDbCache().
export const revalidate = 21600;

export function generateStaticParams() {
  return [];
}

async function getGuide(slug: string) {
  return prisma.article.findFirst({ where: { slug, kind: "GUIDE" } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getGuide(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: `/learn/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.summary,
      publishedTime: article.publishedAt.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
    },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getGuide(slug);
  if (!article) notFound();
  return <ArticleView article={article} />;
}
