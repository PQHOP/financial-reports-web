import type { ArticleKind } from "@/generated/prisma/client";

// Guides live under /learn; previews, comparisons and scorecards under /insights.
export function articlePath(kind: ArticleKind, slug: string): string {
  return kind === "GUIDE" ? `/learn/${slug}` : `/insights/${slug}`;
}

export const articleKindLabels: Record<ArticleKind, string> = {
  GUIDE: "Guide",
  PREVIEW: "Earnings preview",
  COMPARISON: "Comparison",
  SCORECARD: "Scorecard",
};
