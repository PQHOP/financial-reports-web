import Link from "next/link";
import { articleKindLabels, articlePath } from "@/lib/articles";
import type { ArticleKind } from "@/generated/prisma/client";

type Item = {
  slug: string;
  kind: ArticleKind;
  title: string;
  summary: string;
  publishedAt: Date;
};

export function ArticleList({ items, empty }: { items: Item[]; empty: string }) {
  if (items.length === 0) return <p className="text-zinc-500">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.slug}>
          <Link
            href={articlePath(item.kind, item.slug)}
            className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
          >
            <div className="text-sm font-medium text-zinc-500">
              {articleKindLabels[item.kind]}
            </div>
            <div className="mt-1 font-medium">{item.title}</div>
            <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{item.summary}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
