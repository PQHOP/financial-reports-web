import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { systemReports } from "@/lib/community";
import {
  blueskyConfigured,
  postToBluesky,
  postToX,
  xConfigured,
  type PostResult,
  type PostableReport,
} from "@/lib/social";

export const dynamic = "force-dynamic";

const MAX_POSTS_PER_RUN = 5;
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

type Poster = (report: PostableReport) => Promise<PostResult>;

// Called daily by Vercel Cron (see vercel.json). Announces newly published
// reports on whichever platforms have credentials configured; does nothing
// (and marks nothing as posted) when none do.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const posters: Poster[] = [];
  if (blueskyConfigured()) posters.push(postToBluesky);
  if (xConfigured()) posters.push(postToX);

  if (posters.length === 0) {
    return NextResponse.json({
      posted: 0,
      note: "No social credentials configured.",
    });
  }

  const reports = await prisma.report.findMany({
    where: {
      ...systemReports,
      socialPostedAt: null,
      publishedAt: { gte: new Date(Date.now() - LOOKBACK_MS) },
    },
    orderBy: { publishedAt: "asc" },
    take: MAX_POSTS_PER_RUN,
    include: { company: { select: { name: true, ticker: true } } },
  });

  const results: { reportId: string; results: PostResult[] }[] = [];
  for (const report of reports) {
    const outcome = await Promise.all(posters.map((post) => post(report)));
    results.push({ reportId: report.id, results: outcome });
    // Mark as posted if at least one platform accepted it, so a failure on one
    // platform can't cause duplicate posts on the other next run.
    if (outcome.some((r) => r.ok)) {
      await prisma.report.update({
        where: { id: report.id },
        data: { socialPostedAt: new Date() },
      });
    }
  }

  return NextResponse.json({ posted: results.length, results });
}
