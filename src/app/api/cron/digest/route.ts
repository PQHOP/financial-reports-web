import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pingIndexNow } from "@/lib/indexnow";
import { SITE_URL } from "@/lib/site";
import { articlePath } from "@/lib/articles";
import { buildDigest, MIN_DIGEST_ITEMS } from "@/lib/weeklyDigest";

export const dynamic = "force-dynamic";

// Called weekly by Vercel Cron (see vercel.json). Publishes one DIGEST article
// per UTC run date, straight to the site with no review step. No model call:
// it only re-assembles what the site already published. `?force=1` rebuilds
// today's digest.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const slug = `weekly-digest-${now.toISOString().slice(0, 10)}`;
  const force = new URL(request.url).searchParams.get("force") === "1";

  if (!force && (await prisma.article.findUnique({ where: { slug }, select: { id: true } }))) {
    return NextResponse.json({ published: false, note: `${slug} already exists.` });
  }

  try {
    const digest = await buildDigest(now);
    if (!digest) {
      return NextResponse.json({
        published: false,
        note: `Fewer than ${MIN_DIGEST_ITEMS} items this week.`,
      });
    }

    const data = {
      kind: "DIGEST" as const,
      title: digest.title,
      summary: digest.summary,
      contentMd: digest.contentMd,
      tickers: digest.tickers,
    };
    await prisma.article.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });
    const path = articlePath("DIGEST", slug);
    await pingIndexNow([`${SITE_URL}${path}`]);

    return NextResponse.json({
      published: true,
      path,
      reports: digest.reportCount,
      briefs: digest.briefCount,
    });
  } catch (error) {
    console.error("digest cron failed", error);
    return NextResponse.json(
      { published: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
