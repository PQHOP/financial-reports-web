import bundledTracker from "../../scripts/data/report-tracker.json";
import bundledDates from "../../scripts/data/earnings-dates.json";

// The nightly routine pushes tracker updates to GitHub but doesn't redeploy,
// so read the live file from the (public) repo and fall back to the copy
// bundled at build time.
const TRACKER_URL =
  "https://raw.githubusercontent.com/PQHOP/financial-reports-web/master/scripts/data/report-tracker.json";
// Company-announced earnings dates, kept by the daily ops routine (the
// nightly routine owns the tracker, so confirmed dates live in their own file
// and are overlaid here). Same live-then-bundled pattern.
const DATES_URL =
  "https://raw.githubusercontent.com/PQHOP/financial-reports-web/master/scripts/data/earnings-dates.json";

export type NextFiling = {
  type?: string;
  estimate?: string | null;
  confidence?: string;
};

export type TrackerEntry = {
  name?: string;
  status?: string;
  nextExpectedFiling?: NextFiling;
};

export type AnnouncedDate = {
  date: string;
  type?: string;
  source?: string;
  checked?: string;
};

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (res.ok) return (await res.json()) as T;
  } catch {
    // fall through to the bundled copy
  }
  return fallback;
}

// A company's own announced date beats the cadence estimate while it is
// still ahead of us. Once it has passed, the tracker's own estimate (which
// the nightly routine moves on to the next period) is the better signal
// again, so a stale announced date is simply ignored.
export function applyAnnouncedDates(
  tracker: Record<string, TrackerEntry>,
  announced: Record<string, AnnouncedDate | string>,
  today: string
): Record<string, TrackerEntry> {
  const out: Record<string, TrackerEntry> = { ...tracker };
  for (const [ticker, value] of Object.entries(announced)) {
    if (ticker.startsWith("_") || typeof value !== "object" || !value?.date) continue;
    if (value.date < today) continue;
    const entry = tracker[ticker];
    if (!entry) continue;
    out[ticker] = {
      ...entry,
      nextExpectedFiling: {
        ...entry.nextExpectedFiling,
        type: value.type ?? entry.nextExpectedFiling?.type,
        estimate: value.date,
        confidence: "confirmed",
      },
    };
  }
  return out;
}

export async function loadTracker(): Promise<Record<string, TrackerEntry>> {
  const [tracker, announced] = await Promise.all([
    fetchJson<Record<string, TrackerEntry>>(
      TRACKER_URL,
      bundledTracker as unknown as Record<string, TrackerEntry>
    ),
    fetchJson<Record<string, AnnouncedDate | string>>(
      DATES_URL,
      bundledDates as unknown as Record<string, AnnouncedDate | string>
    ),
  ]);
  return applyAnnouncedDates(tracker, announced, new Date().toISOString().slice(0, 10));
}

// The next filing we expect for a covered company, only while it's still
// ahead of us (a passed estimate means the tracker hasn't caught up yet, and
// showing a date in the past as "next" would be wrong).
export async function upcomingFiling(
  ticker: string | null
): Promise<(NextFiling & { estimate: string }) | null> {
  if (!ticker) return null;
  const next = (await loadTracker())[ticker]?.nextExpectedFiling;
  if (!next?.estimate) return null;
  const today = new Date().toISOString().slice(0, 10);
  return next.estimate >= today ? { ...next, estimate: next.estimate } : null;
}

export function formatFilingDate(iso: string, weekday = false): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    ...(weekday ? { weekday: "short" as const } : { year: "numeric" as const }),
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
