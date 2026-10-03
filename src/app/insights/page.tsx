import type { Metadata } from "next";
import { prismaCached as prisma } from "@/lib/prisma";
import { ArticleList } from "@/components/ArticleList";

// Cached on the CDN (ISR); publishes purge it via invalidateDbCache().
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Insights: market briefs, weekly digests, earnings previews",
  description:
    "Daily market briefs, a weekly digest of new analyses, earnings previews, side-by-side company comparisons, and sector scorecards built from SEC filings and public feeds.",
  alternates: { canonical: "/insights" },
};

export default async function InsightsIndex() {
  const items = await prisma.article.findMany({
    where: { NOT: { kind: "GUIDE" } },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="mt-1 text-zinc-500">
          A daily market brief, a weekly digest of new analyses, previews of upcoming earnings, company comparisons, and sector scorecards.
        </p>
      </div>
      <ArticleList items={items} empty="The first insights are coming soon." />
    </div>
  );
}
