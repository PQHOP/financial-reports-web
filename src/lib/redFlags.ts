// /red-flags: the filings that say a company's numbers can't be trusted as
// reported, pulled from EDGAR full-text search (efts.sec.gov) through Next's
// data cache. No database, no model calls. Each kind fails on its own: a
// search that errors leaves its list empty with a note instead of breaking
// the page.
import { unstable_cache } from "next/cache";

export type FlagKind = "non-reliance" | "auditor-change" | "late-filing" | "going-concern";

export type RedFlag = {
  kind: FlagKind;
  form: string;
  company: string;
  ticker: string | null;
  cik: string;
  filedAt: string; // YYYY-MM-DD
  url: string; // the primary document on EDGAR
  items: string[]; // 8-K item numbers, when the form is an 8-K
};

export type FlagSource = { kind: FlagKind; ok: boolean; count: number; fetchedAt: string; note?: string };

export const FLAG_KINDS: Record<
  FlagKind,
  { title: string; what: string; why: string }
> = {
  "non-reliance": {
    title: "Don't rely on our past numbers (8-K Item 4.02)",
    what: "The company tells investors that financial statements it already published should no longer be relied on, usually because an error was found and a restatement is coming.",
    why: "This is the clearest signal a filing can send that reported figures were wrong. Earlier earnings, margins or cash flows may change, and the company's controls are in question.",
  },
  "auditor-change": {
    title: "Auditor resigned or was dismissed (8-K Item 4.01)",
    what: "The company changed its independent auditor. The filing must say whether there were disagreements or 'reportable events' with the old auditor.",
    why: "Most changes are routine (fees, a rotation), but an auditor leaving mid-year, or a filing that mentions disagreements or material weaknesses, often comes before bigger problems.",
  },
  "late-filing": {
    title: "Can't file on time (NT 10-K / NT 10-Q)",
    what: "A notice that the annual or quarterly report will be late. It buys the company a few extra days and must give a reason.",
    why: "A late filing is often the first public sign of an accounting review, an auditor dispute or a liquidity problem; the stated reason is worth reading closely.",
  },
  "going-concern": {
    title: "Substantial doubt about going concern (10-K / 10-Q)",
    what: "The company's own filing says there is substantial doubt it can keep operating for the next twelve months without new money, a deal or a waiver from lenders.",
    why: "It is the filing's way of saying the cash may run out. Growth or profit figures matter less than the funding plan the same filing describes.",
  },
};

const UA = "FinancialReportInsights/1.0 (+https://financialreportinsights.com/contact)";
const LOOKBACK_DAYS = 14;
const PAGE = 100;
const MAX_PAGES = 3;

type Hit = {
  _id: string;
  _source: {
    ciks?: string[];
    display_names?: string[];
    file_date?: string;
    form?: string;
    adsh?: string;
    items?: string[];
  };
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

// "GoPro, Inc.  (GPRO)  (CIK 0001500435)" -> name and ticker. Funds and
// some issuers have no ticker in the display name.
function parseDisplayName(raw: string): { company: string; ticker: string | null } {
  const m = raw.match(/^(.*?)\s+\(([A-Z0-9.\-]{1,10})\)\s+\(CIK \d+\)\s*$/);
  if (m) return { company: m[1].trim(), ticker: m[2] };
  return { company: raw.replace(/\s+\(CIK \d+\)\s*$/, "").trim(), ticker: null };
}

function documentUrl(cik: string, hitId: string): string {
  const [adsh, file] = hitId.split(":");
  const folder = adsh.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${folder}/${file ?? ""}`;
}

async function search(params: Record<string, string>, maxPages: number): Promise<Hit[]> {
  const out: Hit[] = [];
  const start = isoDaysAgo(LOOKBACK_DAYS);
  const end = isoDaysAgo(0);
  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({
      ...params,
      dateRange: "custom",
      startdt: start,
      enddt: end,
      from: String(page * PAGE),
    });
    const res = await fetch(`https://efts.sec.gov/LATEST/search-index?${qs}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`${res.status} from efts.sec.gov`);
    const json = (await res.json()) as { hits?: { hits?: Hit[] } };
    const hits = json.hits?.hits ?? [];
    out.push(...hits);
    if (hits.length < PAGE) break;
  }
  return out;
}

function toFlags(kind: FlagKind, hits: Hit[], keep: (h: Hit) => boolean): RedFlag[] {
  const seen = new Set<string>();
  const flags: RedFlag[] = [];
  for (const h of hits) {
    const s = h._source;
    if (!s.adsh || !s.file_date || !s.form || !keep(h)) continue;
    const cik = String(Number(s.ciks?.[0] ?? "0"));
    const key = `${cik}:${s.adsh}`;
    if (!cik || cik === "0" || seen.has(key)) continue;
    seen.add(key);
    const { company, ticker } = parseDisplayName(s.display_names?.[0] ?? "");
    flags.push({
      kind,
      form: s.form,
      company: company || `CIK ${cik}`,
      ticker,
      cik,
      filedAt: s.file_date,
      url: documentUrl(cik, h._id),
      items: s.items ?? [],
    });
  }
  return flags.sort((a, b) => b.filedAt.localeCompare(a.filedAt));
}

// One query per kind. The 8-K searches use the item's own phrase as the text
// query and then check `items`, so a filing that merely mentions "4.02" in
// another context is left out.
const QUERIES: Record<FlagKind, () => Promise<RedFlag[]>> = {
  "non-reliance": async () =>
    toFlags("non-reliance", await search({ q: '"Item 4.02"', forms: "8-K" }, MAX_PAGES), (h) =>
      (h._source.items ?? []).includes("4.02")
    ),
  "auditor-change": async () =>
    toFlags("auditor-change", await search({ q: '"Item 4.01"', forms: "8-K" }, MAX_PAGES), (h) =>
      (h._source.items ?? []).includes("4.01")
    ),
  "late-filing": async () => {
    const [k, q] = await Promise.all([
      search({ forms: "NT 10-K" }, MAX_PAGES),
      search({ forms: "NT 10-Q" }, MAX_PAGES),
    ]);
    return toFlags("late-filing", [...k, ...q], () => true);
  },
  "going-concern": async () =>
    toFlags(
      "going-concern",
      await search({ q: '"substantial doubt" "going concern"', forms: "10-K,10-Q" }, 1),
      () => true
    ),
};

async function fetchKindUncached(kind: FlagKind): Promise<{ flags: RedFlag[]; source: FlagSource }> {
  const fetchedAt = new Date().toISOString();
  try {
    const flags = await QUERIES[kind]();
    return { flags, source: { kind, ok: true, count: flags.length, fetchedAt } };
  } catch (err) {
    return {
      flags: [],
      source: { kind, ok: false, count: 0, fetchedAt, note: err instanceof Error ? err.message : String(err) },
    };
  }
}

export const fetchRedFlags = unstable_cache(
  async () => {
    const kinds = Object.keys(FLAG_KINDS) as FlagKind[];
    const results = await Promise.all(kinds.map(fetchKindUncached));
    return {
      lookbackDays: LOOKBACK_DAYS,
      flags: results.flatMap((r) => r.flags),
      sources: results.map((r) => r.source),
    };
  },
  ["red-flags-edgar"],
  { revalidate: 3600 }
);
