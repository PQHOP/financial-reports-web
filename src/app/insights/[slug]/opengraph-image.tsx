import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { articleKindLabels } from "@/lib/articles";
import { SITE_NAME } from "@/lib/site";

export const alt = "Financial Report Insights";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const dynamic = "force-dynamic";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await prisma.article.findFirst({
    where: { slug, NOT: { kind: "GUIDE" } },
    select: { kind: true, title: true, summary: true, publishedAt: true, tickers: true },
  });

  const title = article?.title ?? SITE_NAME;
  const clippedTitle = title.length > 110 ? `${title.slice(0, 107)}...` : title;
  const summary = article?.summary ?? "";
  const clippedSummary = summary.length > 170 ? `${summary.slice(0, 167)}...` : summary;
  const date = article?.publishedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f172a",
          color: "#ffffff",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#94a3b8" }}>
          {SITE_NAME}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {article && (
            <div style={{ display: "flex", fontSize: 34, color: "#38bdf8" }}>
              {articleKindLabels[article.kind]}
              {date ? ` · ${date}` : ""}
            </div>
          )}
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>
            {clippedTitle}
          </div>
          {clippedSummary && (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                color: "#94a3b8",
                lineHeight: 1.35,
              }}
            >
              {clippedSummary}
            </div>
          )}
        </div>
      </div>
    ),
    size
  );
}
