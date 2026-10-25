import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { systemReports } from "@/lib/community";
import { reportUrl } from "@/lib/reportPath";
import { cleanCompanyName } from "@/lib/companyName";
import {
  ALL_TICKERS,
  alertsEnabled,
  reportAlertEmail,
  sendEmail,
  unsubscribeUrl,
} from "@/lib/alerts";

export const dynamic = "force-dynamic";
// Sends are spaced out (see SEND_GAP_MS), so a full run takes a few minutes.
export const maxDuration = 300;

// Runs daily at 23:20 UTC, after the nightly publishing window (16:00–22:59
// UTC) and the social cron. 26h rather than 24h so a report published just
// before yesterday's run is still picked up if that run failed to send it.
const LOOKBACK_MS = 26 * 60 * 60 * 1000;
const MAX_EMAILS_PER_RUN = 200;
// Resend's default API rate limit is 2 requests per second.
const SEND_GAP_MS = 550;
// Unconfirmed signups older than this are dropped: the link was never
// clicked, and keeping the address serves no purpose.
const PENDING_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Called daily by Vercel Cron (see vercel.json). Emails each confirmed
// subscriber once per newly published system report of the company they
// follow; does nothing without RESEND_API_KEY.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!alertsEnabled()) {
    return NextResponse.json({ sent: 0, note: "RESEND_API_KEY not set." });
  }

  const { count: expired } = await prisma.subscription.deleteMany({
    where: { confirmedAt: null, createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) } },
  });

  const reports = await prisma.report.findMany({
    where: {
      ...systemReports,
      publishedAt: { gte: new Date(Date.now() - LOOKBACK_MS) },
      company: { ticker: { not: null } },
    },
    // Oldest first: lastSentAt is set to each report's publishedAt, which only
    // works as a "sent up to here" marker if reports go out in order.
    orderBy: { publishedAt: "asc" },
    select: {
      id: true,
      year: true,
      period: true,
      title: true,
      summary: true,
      publishedAt: true,
      company: { select: { name: true, ticker: true, slug: true } },
    },
  });

  let sent = 0;
  let failed = 0;
  let stopped: string | null = null;

  outer: for (const report of reports) {
    const ticker = report.company.ticker!.toUpperCase();
    const subscribers = await prisma.subscription.findMany({
      where: {
        ticker: { in: [ticker, ALL_TICKERS] },
        // Confirmed before the report went out: someone who signs up on the
        // page of a report they just read is waiting for the *next* one.
        confirmedAt: { not: null, lt: report.publishedAt },
        OR: [{ lastSentAt: null }, { lastSentAt: { lt: report.publishedAt } }],
      },
      orderBy: { confirmedAt: "asc" },
      take: MAX_EMAILS_PER_RUN - sent - failed,
    });

    const url = reportUrl({ ...report, origin: "ADMIN" });
    for (const sub of subscribers) {
      if (sent + failed >= MAX_EMAILS_PER_RUN) {
        stopped = "per-run cap reached";
        break outer;
      }
      const email = reportAlertEmail({
        title: report.title,
        summary: report.summary,
        url,
        companyName: cleanCompanyName(report.company.name),
        ticker,
        allReports: sub.ticker === ALL_TICKERS,
        unsubscribe: unsubscribeUrl(sub.token),
      });
      const result = await sendEmail({ to: sub.email, ...email });
      if (result.ok) {
        sent++;
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { lastSentAt: report.publishedAt },
        });
      } else {
        failed++;
        console.error("alerts cron: send failed", sub.id, result.status, result.error);
        // Rate-limited or quota exhausted (Resend's free tier is 100/day):
        // stop and let tomorrow's run pick up the rest, still inside the
        // lookback window.
        if (result.status === 429 || result.status === 401 || result.status === 403) {
          stopped = `Resend returned ${result.status}`;
          break outer;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS));
    }
    if (sent + failed >= MAX_EMAILS_PER_RUN) {
      stopped = "per-run cap reached";
      break;
    }
  }

  return NextResponse.json({ reports: reports.length, sent, failed, stopped, expired });
}
