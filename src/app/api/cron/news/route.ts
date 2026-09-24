import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pingIndexNow } from "@/lib/indexnow";
import { SITE_URL } from "@/lib/site";
import { articlePath } from "@/lib/articles";
import { buildBrief } from "@/lib/newsBrief";

export const dynamic = "force-dynamic";
// Feed fetching plus one model call; the default limit is too tight.
export const maxDuration = 300;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Called on weekday mornings by Vercel Cron (see vercel.json), before the US
// market opens. Publishes one NEWS article
// per UTC day, so a retried or double-fired cron never creates a duplicate.
// `?force=1` regenerates today's brief.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ published: false, note: "ANTHROPIC_API_KEY not set." });
  }

  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const dateLabel = `${MONTHS[now.getUTCMonth()]} ${now.getUTCDate()}, ${now.getUTCFullYear()}`;
  const slug = `market-brief-${isoDate}`;
  const force = new URL(request.url).searchParams.get("force") === "1";

  if (!force && (await prisma.article.findUnique({ where: { slug }, select: { id: true } }))) {
    return NextResponse.json({ published: false, note: `${slug} already exists.` });
  }

  try {
    // Monday morning covers the weekend (no brief on Saturday or Sunday).
    const windowHours = now.getUTCDay() === 1 ? 66 : 30;
    const brief = await buildBrief(dateLabel, windowHours);
    if ("skipped" in brief) {
      return NextResponse.json({ published: false, ...brief });
    }

    const data = {
      kind: "NEWS" as const,
      title: brief.title,
      summary: brief.summary,
      contentMd: brief.contentMd,
      tickers: brief.tickers,
    };
    await prisma.article.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });
    const path = articlePath("NEWS", slug);
    await pingIndexNow([`${SITE_URL}${path}`]);

    return NextResponse.json({
      published: true,
      path,
      stories: brief.storyCount,
      droppedStories: brief.droppedStories,
      items: brief.itemCount,
      model: brief.model,
      usage: brief.usage,
    });
  } catch (error) {
    console.error("news cron failed", error);
    return NextResponse.json(
      { published: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
