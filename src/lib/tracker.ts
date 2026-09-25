import bundledTracker from "../../scripts/data/report-tracker.json";

// The nightly routine pushes tracker updates to GitHub but doesn't redeploy,
// so read the live file from the (public) repo and fall back to the copy
// bundled at build time.
const TRACKER_URL =
  "https://raw.githubusercontent.com/PQHOP/financial-reports-web/master/scripts/data/report-tracker.json";

export type NextFiling = {
  type?: string;
  estimate?: string;
  confidence?: string;
};

export type TrackerEntry = {
  name?: string;
  status?: string;
  nextExpectedFiling?: NextFiling;
};

export async function loadTracker(): Promise<Record<string, TrackerEntry>> {
  try {
    const res = await fetch(TRACKER_URL, { next: { revalidate: 900 } });
    if (res.ok) return (await res.json()) as Record<string, TrackerEntry>;
  } catch {
    // fall through to the bundled copy
  }
  return bundledTracker as Record<string, TrackerEntry>;
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
