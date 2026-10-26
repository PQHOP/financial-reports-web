import type { ReportPeriod } from "@/generated/prisma/client";
import {
  formatMoneyMillions,
  formatPct,
  formatPerShare,
  metricsProfile,
  type ReportMetrics,
} from "@/lib/metrics";
import { formatFilingDate, isFollowUpFiling, type NextFiling } from "@/lib/tracker";

// The two plain sentences under a company page's H1, written for the search
// snippet of "<ticker> earnings": when the next results are due, and what
// the last published quarter showed. Built only from stored `metrics` and
// the tracker/announced-date overlay, so the page stays ISR with no extra
// query. Google was showing the figures table as the snippet (10-26 review);
// a sentence that answers the query earns the click.

function periodPhrase(r: { year: number; period: ReportPeriod }): string {
  switch (r.period) {
    case "ANNUAL":
      return `fiscal ${r.year}`;
    case "H1":
      return `the first half of ${r.year}`;
    default:
      return `${r.period} ${r.year}`;
  }
}

function moved(pct: number | undefined, verb = "was"): string {
  if (pct === undefined) return verb;
  if (pct > 0) return `rose ${formatPct(pct, false)} to`;
  if (pct < 0) return `fell ${formatPct(Math.abs(pct), false)} to`;
  return "was flat at";
}

function lastPeriodSentence(
  name: string,
  latest: { year: number; period: ReportPeriod },
  m: ReportMetrics | null
): string | null {
  if (!m) return null;
  const cur = m.currency;
  const parts: string[] = [];
  const profile = metricsProfile(m);
  if (profile === "bank" && m.netInterestIncome !== undefined) {
    parts.push(
      `net interest income ${moved(m.netInterestIncomeYoyPct)} ${formatMoneyMillions(m.netInterestIncome, cur)}`
    );
    if (m.netInterestMarginPct !== undefined) {
      parts.push(`net interest margin was ${m.netInterestMarginPct.toFixed(2)}%`);
    }
  } else if (profile === "insurer" && m.netPremiumsWritten !== undefined) {
    parts.push(
      `net premiums written ${moved(m.netPremiumsWrittenYoyPct)} ${formatMoneyMillions(m.netPremiumsWritten, cur)}`
    );
    if (m.combinedRatioPct !== undefined) {
      parts.push(`the combined ratio was ${formatPct(m.combinedRatioPct, false)}`);
    }
  } else if (m.revenue !== undefined) {
    parts.push(`revenue ${moved(m.revenueYoyPct)} ${formatMoneyMillions(m.revenue, cur)}`);
  }
  if (m.epsDiluted !== undefined) {
    const eps = formatPerShare(m.epsDiluted, cur);
    if (m.epsDiluted < 0) {
      parts.push(`the diluted loss per share was ${eps}`);
    } else {
      parts.push(`diluted EPS ${moved(m.epsYoyPct)} ${eps}`);
    }
  } else if (m.netIncome !== undefined) {
    parts.push(`net income ${moved(m.netIncomeYoyPct)} ${formatMoneyMillions(m.netIncome, cur)}`);
  }
  if (parts.length === 0) return null;
  const body =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `In ${periodPhrase(latest)}, ${name}'s ${body}.`;
}

function nextSentence(
  name: string,
  latest: { year: number; period: ReportPeriod } | undefined,
  next: (NextFiling & { estimate: string }) | null
): string | null {
  if (!next) return null;
  const date = formatFilingDate(next.estimate);
  const followUp =
    latest !== undefined &&
    isFollowUpFiling({
      latestReport: { year: latest.year, period: latest.period },
      nextExpectedFiling: next,
    });
  if (followUp) {
    return `${name}'s full ${periodPhrase(latest)} filing is expected around ${date}; our analysis below is from the earnings release.`;
  }
  return next.confidence === "confirmed"
    ? `${name} reports its next results on ${date} (company-confirmed date).`
    : `${name}'s next results are expected around ${date}, estimated from past filing dates.`;
}

export function companyLead(input: {
  name: string;
  latest?: { year: number; period: ReportPeriod };
  metrics: ReportMetrics | null;
  next: (NextFiling & { estimate: string }) | null;
}): string | null {
  const sentences = [
    nextSentence(input.name, input.latest, input.next),
    input.latest ? lastPeriodSentence(input.name, input.latest, input.metrics) : null,
  ].filter((s): s is string => Boolean(s));
  return sentences.length > 0 ? sentences.join(" ") : null;
}
