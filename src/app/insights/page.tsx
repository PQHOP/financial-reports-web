import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ArticleList } from "@/components/ArticleList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Insights: earnings previews, comparisons, scorecards",
  description:
    "Earnings previews, side-by-side company comparisons, and sector scorecards built from SEC filings.",
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
          Previews of upcoming earnings, company comparisons, and sector scorecards.
        </p>
      </div>
      <ArticleList items={items} empty="The first insights are coming soon." />
    </div>
  );
}
