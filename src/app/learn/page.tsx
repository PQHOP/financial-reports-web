import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ArticleList } from "@/components/ArticleList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learn: how to read earnings reports",
  description:
    "Plain-English guides to earnings reports: what the terms mean and how to read a 10-Q or 10-K, with no finance background needed.",
  alternates: { canonical: "/learn" },
};

export default async function LearnIndex() {
  const guides = await prisma.article.findMany({
    where: { kind: "GUIDE" },
    orderBy: { title: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Learn</h1>
        <p className="mt-1 text-zinc-500">
          Short guides to the terms and documents behind an earnings report.
        </p>
      </div>
      <ArticleList items={guides} empty="Guides are coming soon." />
    </div>
  );
}
