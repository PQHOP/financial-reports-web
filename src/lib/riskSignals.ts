// /world-risks "other signals": events that don't look financial at first
// glance but reach company results through a known channel — space weather,
// river levels, actively exploited software flaws, serious product recalls
// and severe US weather. Free official feeds, fetched server-side and cached
// with unstable_cache; each fails on its own. Company links follow the same
// rule as src/lib/riskImpacts.ts: established channels only, no guesses about
// a specific company's exposure.
import { unstable_cache } from "next/cache";
import type { ImpactGroup } from "@/lib/riskImpacts";

export type SignalState = "alert" | "watch" | "normal" | "unavailable";

export type SignalItem = { label: string; sub?: string; url?: string; tickers?: string[] };

export type Signal = {
  id: string;
  title: string;
  state: SignalState;
  headline: string;
  why: string;
  // Shown only when state is "alert" or "watch".
  groups: ImpactGroup[];
  items: SignalItem[];
  source: { name: string; url: string; lag: string; ok: boolean; fetchedAt: string };
};

const UA = "FinancialReportInsights/1.0 (+https://financialreportinsights.com/contact)";
const DAY = 86_400_000;

async function get(url: string, accept = "application/json"): Promise<Response> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: accept },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res;
}

// The error itself isn't shown to visitors; the red status dot says enough.
function failed(base: Omit<Signal, "state" | "headline" | "groups" | "items">): Signal {
  return {
    ...base,
    state: "unavailable",
    headline: "Source unavailable right now; try again shortly.",
    groups: [],
    items: [],
    source: { ...base.source, ok: false, fetchedAt: new Date().toISOString() },
  };
}

// ---- Space weather (NOAA SWPC) -------------------------------------------
// NOAA's own G-scale: G3 "strong" is where it lists voltage corrections on
// power systems and intermittent satellite navigation and HF radio.
const G_TEXT: Record<string, string> = {
  "1": "G1 minor",
  "2": "G2 moderate",
  "3": "G3 strong",
  "4": "G4 severe",
  "5": "G5 extreme",
};

async function spaceWeatherUncached(): Promise<Signal> {
  const base = {
    id: "space-weather",
    title: "Space weather (geomagnetic storms)",
    why: "Strong solar storms induce currents in long power lines and disturb satellites, GPS and polar-route aircraft radio. At NOAA's G3 level and above, grid operators may need to correct voltages, satellite navigation can drop out, and airlines can reroute polar flights.",
    source: {
      name: "NOAA Space Weather Prediction Center",
      url: "https://www.swpc.noaa.gov/",
      lag: "minutes",
      ok: true,
      fetchedAt: new Date().toISOString(),
    },
  };
  try {
    const scales = (await (await get("https://services.swpc.noaa.gov/products/noaa-scales.json")).json()) as Record<
      string,
      { DateStamp: string; G: { Scale: string | null; Text: string | null } }
    >;
    // "0" is now; "1"-"3" are NOAA's forecast for the next three days.
    const now = Number(scales["0"]?.G.Scale ?? 0);
    const forecast = ["1", "2", "3"].map((k) => ({
      day: scales[k]?.DateStamp,
      g: Number(scales[k]?.G.Scale ?? 0),
    }));
    const worst = Math.max(now, ...forecast.map((f) => f.g));
    const state: SignalState = worst >= 3 ? "alert" : worst >= 1 ? "watch" : "normal";
    return {
      ...base,
      state,
      headline:
        now > 0
          ? `Geomagnetic storm in progress: ${G_TEXT[String(now)]}.`
          : worst > 0
            ? `Quiet now; NOAA forecasts up to ${G_TEXT[String(worst)]} in the next three days.`
            : "Quiet: no geomagnetic storm now or forecast for the next three days.",
      groups:
        worst >= 3
          ? [
              { role: "Electric utilities (grid operations)", tickers: ["NEE", "DUK", "SO", "AEP"] },
              { role: "Airlines (polar routes)", tickers: ["DAL", "UAL", "AAL"] },
              { role: "GPS devices", tickers: ["GRMN"] },
            ]
          : [],
      items: forecast
        .filter((f) => f.day)
        .map((f) => ({ label: f.day!, sub: f.g > 0 ? `Forecast ${G_TEXT[String(f.g)]}` : "No storm forecast" })),
    };
  } catch {
    return failed(base);
  }
}

// ---- Mississippi River at Memphis (USGS) ---------------------------------
// Flow against this calendar day's history since 1933: low water forces
// barges to carry lighter loads (the grain export route to the Gulf); very
// high water brings closures and flooding.
async function mississippiUncached(): Promise<Signal> {
  const base = {
    id: "mississippi",
    title: "Mississippi River (Memphis)",
    why: "Most US corn and soybean exports travel by barge down the Mississippi to Gulf ports. In low water barges must carry lighter loads or wait, which raises shipping costs for grain companies; very high water can close stretches of the river.",
    source: {
      name: "USGS Water Services (gauge 07032000)",
      url: "https://waterdata.usgs.gov/monitoring-location/07032000/",
      lag: "about an hour",
      ok: true,
      fetchedAt: new Date().toISOString(),
    },
  };
  try {
    const [iv, stat] = await Promise.all([
      get("https://waterservices.usgs.gov/nwis/iv/?sites=07032000&parameterCd=00060&format=json&period=P1D"),
      get(
        "https://waterservices.usgs.gov/nwis/stat/?sites=07032000&statReportType=daily&statTypeCd=p10,p50,p95&parameterCd=00060&format=rdb",
        "text/plain"
      ),
    ]);
    const series = ((await iv.json()) as {
      value: { timeSeries: { values: { value: { value: string; dateTime: string }[] }[] }[] };
    }).value.timeSeries[0].values[0].value;
    const last = series[series.length - 1];
    const flow = Number(last.value);
    // The gauge's own time is Central; the day of year is what matters.
    const [, m, d] = last.dateTime.slice(0, 10).split("-").map(Number);
    const rows = (await stat.text())
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("\t"));
    const header = rows[0];
    const row = rows.find((r) => Number(r[header.indexOf("month_nu")]) === m && Number(r[header.indexOf("day_nu")]) === d);
    if (!row || !Number.isFinite(flow)) throw new Error("no USGS statistics for today");
    const p = (name: string) => Number(row[header.indexOf(name)]);
    const [p10, p50, p95] = [p("p10_va"), p("p50_va"), p("p95_va")];
    const years = `${row[header.indexOf("begin_yr")]}–${row[header.indexOf("end_yr")]}`;
    const k = (v: number) => `${Math.round(v / 1000).toLocaleString("en-US")}k`;
    let state: SignalState = "normal";
    let headline = `Flow ${k(flow)} cubic feet per second, ${flow >= p50 ? "above" : "below"} the median for this date (${k(p50)}).`;
    if (flow < p10) {
      state = "alert";
      headline = `Low water: flow ${k(flow)} cubic feet per second, lower than on this date in 90% of years (${years}).`;
    } else if (Number.isFinite(p95) && flow > p95) {
      state = "alert";
      headline = `Very high water: flow ${k(flow)} cubic feet per second, higher than on this date in 95% of years (${years}).`;
    }
    return {
      ...base,
      state,
      headline,
      groups: state === "alert" ? [{ role: "Grain traders and processors", tickers: ["ADM", "BG"] }] : [],
      items: [
        { label: "Now", sub: `${k(flow)} ft³/s` },
        { label: "Median for this date", sub: `${k(p50)} ft³/s` },
        { label: "Low-water line (10th percentile)", sub: `${k(p10)} ft³/s` },
      ],
    };
  } catch {
    return failed(base);
  }
}

// ---- CISA Known Exploited Vulnerabilities --------------------------------
// Vendor names as CISA writes them -> tickers we cover.
const KEV_VENDORS: Record<string, string> = {
  microsoft: "MSFT",
  google: "GOOGL",
  apple: "AAPL",
  cisco: "CSCO",
  fortinet: "FTNT",
  "palo alto networks": "PANW",
  oracle: "ORCL",
  vmware: "AVGO",
  broadcom: "AVGO",
  adobe: "ADBE",
  ibm: "IBM",
  f5: "FFIV",
  dell: "DELL",
  "hewlett packard enterprise (hpe)": "HPE",
  "hewlett packard enterprise": "HPE",
  juniper: "HPE",
  qualcomm: "QCOM",
  intel: "INTC",
  crowdstrike: "CRWD",
};

async function exploitedFlawsUncached(): Promise<Signal> {
  const base = {
    id: "exploited-flaws",
    title: "Software flaws under active attack",
    why: "CISA, the US cyber-defence agency, lists flaws it has evidence attackers are already exploiting and orders federal agencies to patch them. A flaw in a widely used product means emergency patching for its customers and scrutiny for the vendor; this is also the threat security-software companies sell protection against.",
    source: {
      name: "CISA Known Exploited Vulnerabilities catalog",
      url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      lag: "same day",
      ok: true,
      fetchedAt: new Date().toISOString(),
    },
  };
  try {
    const data = (await (
      await get("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json")
    ).json()) as {
      vulnerabilities: {
        cveID: string;
        vendorProject: string;
        product: string;
        vulnerabilityName: string;
        dateAdded: string;
        knownRansomwareCampaignUse: string;
      }[];
    };
    const since = new Date(Date.now() - 14 * DAY).toISOString().slice(0, 10);
    const recent = data.vulnerabilities.filter((v) => v.dateAdded >= since).sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
    const items: SignalItem[] = recent.map((v) => {
      const ticker = KEV_VENDORS[v.vendorProject.toLowerCase()];
      return {
        label: `${v.vendorProject} ${v.product}`,
        sub: `${v.cveID} · added ${v.dateAdded}${v.knownRansomwareCampaignUse === "Known" ? " · used in ransomware" : ""}`,
        url: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
        tickers: ticker ? [ticker] : undefined,
      };
    });
    const vendorsCovered = [...new Set(items.flatMap((i) => i.tickers ?? []))];
    return {
      ...base,
      state: vendorsCovered.length > 0 ? "watch" : "normal",
      headline: `${recent.length} actively exploited ${recent.length === 1 ? "flaw" : "flaws"} added in the last 14 days${
        vendorsCovered.length > 0 ? `, including products from ${vendorsCovered.join(", ")}` : ""
      }.`,
      groups:
        recent.length > 0
          ? [
              ...(vendorsCovered.length > 0 ? [{ role: "Vendors of affected products", tickers: vendorsCovered }] : []),
              { role: "Security software", tickers: ["CRWD", "PANW", "FTNT"] },
            ]
          : [],
      // Products from companies we cover first, then newest.
      items: [...items.filter((i) => i.tickers), ...items.filter((i) => !i.tickers)].slice(0, 12),
    };
  } catch {
    return failed(base);
  }
}

// ---- FDA Class I recalls (openFDA) ---------------------------------------
// Class I = "reasonable probability" of serious harm or death. Firm names as
// they appear in openFDA -> tickers we cover (subsidiaries included).
const RECALL_FIRMS: [RegExp, string][] = [
  [/\babbott\b/i, "ABT"],
  [/\bmedtronic\b/i, "MDT"],
  [/boston scientific/i, "BSX"],
  [/\bbaxter\b/i, "BAX"],
  [/becton|\bbd\b|c\.?\s?r\.?\s?bard/i, "BDX"],
  [/\bstryker\b/i, "SYK"],
  [/zimmer/i, "ZBH"],
  [/johnson\s*&\s*johnson|depuy|ethicon|\babiomed\b/i, "JNJ"],
  [/ge healthcare|ge medical/i, "GEHC"],
  [/intuitive surgical/i, "ISRG"],
  [/edwards lifesciences/i, "EW"],
  [/\bdexcom\b/i, "DXCM"],
  [/\binsulet\b/i, "PODD"],
  [/\bresmed\b/i, "RMD"],
  [/\bpfizer\b|hospira/i, "PFE"],
  [/\bmerck\b/i, "MRK"],
  [/eli lilly/i, "LLY"],
  [/\btyson\b/i, "TSN"],
  [/kraft heinz/i, "KHC"],
  [/general mills/i, "GIS"],
  [/\bhormel\b/i, "HRL"],
  [/smucker/i, "SJM"],
  [/pepsico|frito-lay|quaker oats/i, "PEP"],
  [/mondelez/i, "MDLZ"],
  [/\bhershey\b/i, "HSY"],
  [/campbell/i, "CPB"],
  [/keurig dr pepper/i, "KDP"],
];

type Enforcement = {
  recalling_firm: string;
  product_description: string;
  reason_for_recall: string;
  report_date: string;
  recall_number: string;
};

async function recallsUncached(): Promise<Signal> {
  const base = {
    id: "recalls",
    title: "Serious product recalls (FDA Class I)",
    why: "Class I is the FDA's most serious recall category: a product that could cause serious injury or death. For the maker it means replacement or refund costs, sometimes paused sales, and a risk of lawsuits; a recall is often disclosed later as a one-off charge in results.",
    source: {
      name: "U.S. FDA enforcement reports (openFDA)",
      url: "https://open.fda.gov/apis/",
      lag: "about a week (weekly enforcement reports)",
      ok: true,
      fetchedAt: new Date().toISOString(),
    },
  };
  try {
    const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
    const range = `report_date:[${ymd(Date.now() - 45 * DAY)}+TO+${ymd(Date.now())}]`;
    const q = (kind: string) =>
      get(`https://api.fda.gov/${kind}/enforcement.json?search=classification:%22Class+I%22+AND+${range}&limit=100`)
        .then((r) => r.json() as Promise<{ results?: Enforcement[] }>)
        // openFDA answers 404 when nothing matches.
        .catch((e: unknown) => (String(e).includes("404") ? { results: [] } : Promise.reject(e)));
    const [device, drug, food] = await Promise.all([q("device"), q("drug"), q("food")]);
    const all = [
      ...(device.results ?? []).map((r) => ({ ...r, kind: "Medical device" })),
      ...(drug.results ?? []).map((r) => ({ ...r, kind: "Drug" })),
      ...(food.results ?? []).map((r) => ({ ...r, kind: "Food" })),
    ];
    const seen = new Set<string>();
    const matched: SignalItem[] = [];
    for (const r of all.sort((a, b) => b.report_date.localeCompare(a.report_date))) {
      const ticker = RECALL_FIRMS.find(([re]) => re.test(r.recalling_firm))?.[1];
      if (!ticker) continue;
      const key = `${ticker}|${r.product_description.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const date = `${r.report_date.slice(0, 4)}-${r.report_date.slice(4, 6)}-${r.report_date.slice(6, 8)}`;
      matched.push({
        label: `${r.recalling_firm}: ${r.product_description.replace(/\s+/g, " ").slice(0, 90)}${r.product_description.length > 90 ? "…" : ""}`,
        sub: `${r.kind} · reported ${date} · ${r.reason_for_recall.replace(/\s+/g, " ").slice(0, 140)}${r.reason_for_recall.length > 140 ? "…" : ""}`,
        tickers: [ticker],
      });
    }
    const tickers = [...new Set(matched.flatMap((m) => m.tickers ?? []))];
    return {
      ...base,
      state: tickers.length > 0 ? "watch" : "normal",
      headline: `${all.length} Class I recalls in FDA reports over the last 45 days; ${
        matched.length > 0 ? `${matched.length} from companies we cover (${tickers.join(", ")})` : "none from companies we cover"
      }.`,
      groups: tickers.length > 0 ? [{ role: "Companies with a Class I recall", tickers }] : [],
      items: matched.slice(0, 10),
    };
  } catch {
    return failed(base);
  }
}

// ---- Severe US weather (National Weather Service) ------------------------
type NwsAlert = { properties: { event: string; areaDesc: string; expires: string; headline: string | null } };

const WEATHER_GROUPS: {
  key: string;
  label: string;
  match: RegExp;
  why: string;
  groups: (states: Set<string>) => ImpactGroup[];
}[] = [
  {
    key: "tropical",
    label: "Hurricane / tropical storm warnings",
    match: /^(Hurricane|Tropical Storm|Storm Surge) Warning$/,
    why: "property claims for insurers, and on the Texas and Louisiana coast, refinery and port shutdowns",
    groups: (s) => [
      { role: "Property and casualty insurers", tickers: ["TRV", "ALL", "PGR", "CB"] },
      ...(s.has("TX") || s.has("LA") ? [{ role: "Gulf Coast refiners", tickers: ["VLO", "MPC", "PSX"] }] : []),
    ],
  },
  {
    key: "heat",
    label: "Extreme heat warnings",
    match: /^(Extreme|Excessive) Heat Warning$/,
    why: "air-conditioning demand and wholesale power prices, which independent power producers sell into",
    groups: () => [{ role: "Power producers", tickers: ["VST", "CEG", "NRG"] }],
  },
  {
    key: "winter",
    label: "Winter storm, blizzard and ice warnings",
    match: /^(Winter Storm|Blizzard|Ice Storm|Extreme Cold) Warning$/,
    why: "flight cancellations for airlines and heating demand for natural gas",
    groups: () => [
      { role: "Airlines", tickers: ["DAL", "UAL", "AAL", "LUV"] },
      { role: "Natural gas producers", tickers: ["EQT", "EXE"] },
    ],
  },
  {
    key: "fire",
    label: "Red flag (extreme fire weather) warnings",
    match: /^Red Flag Warning$/,
    why: "in California, utilities may cut power to lines to avoid sparking fires, and fires started by power equipment bring large liabilities",
    groups: (s) => (s.has("CA") ? [{ role: "California utilities", tickers: ["PCG", "EIX"] }] : []),
  },
];

async function usWeatherUncached(): Promise<Signal> {
  const base = {
    id: "us-weather",
    title: "Severe US weather warnings",
    why: "Some weather warnings reach company results within days:",
    source: {
      name: "U.S. National Weather Service alerts",
      url: "https://www.weather.gov/alerts",
      lag: "minutes",
      ok: true,
      fetchedAt: new Date().toISOString(),
    },
  };
  try {
    const data = (await (
      await get("https://api.weather.gov/alerts/active?status=actual&message_type=alert,update", "application/geo+json")
    ).json()) as { features: NwsAlert[] };
    const items: SignalItem[] = [];
    const groups: ImpactGroup[] = [];
    const whys: string[] = [];
    for (const g of WEATHER_GROUPS) {
      const hits = data.features.filter((f) => g.match.test(f.properties.event));
      if (hits.length === 0) continue;
      // areaDesc: "Dona Ana, NM; Otero, NM"
      const states = new Set(
        hits.flatMap((h) => h.properties.areaDesc.split(";").map((a) => a.trim().slice(-2)).filter((s) => /^[A-Z]{2}$/.test(s)))
      );
      items.push({ label: g.label, sub: `${hits.length} active · ${[...states].sort().join(", ")}` });
      const impact = g.groups(states);
      if (impact.length > 0) {
        groups.push(...impact);
        whys.push(`${g.label.toLowerCase()} affect ${g.why}`);
      }
    }
    return {
      ...base,
      why:
        whys.length > 0
          ? `Active warnings with a known business channel: ${whys.join("; ")}.`
          : "Watched here: hurricane, extreme heat, winter storm and California fire-weather warnings, each of which has a known route into company results (insurance claims, power prices, flight cancellations, utility liabilities).",
      state: groups.length > 0 ? "watch" : "normal",
      headline:
        items.length > 0
          ? `${items.length} of the watched warning types active now.`
          : "None of the watched warning types (hurricane, extreme heat, winter storm, California fire weather) is active.",
      groups,
      items,
    };
  } catch {
    return failed(base);
  }
}

export const fetchSpaceWeather = unstable_cache(spaceWeatherUncached, ["signals-swpc"], { revalidate: 900 });
export const fetchMississippi = unstable_cache(mississippiUncached, ["signals-mississippi"], { revalidate: 1800 });
export const fetchExploitedFlaws = unstable_cache(exploitedFlawsUncached, ["signals-kev"], { revalidate: 3600 });
export const fetchRecalls = unstable_cache(recallsUncached, ["signals-fda"], { revalidate: 3600 * 6 });
export const fetchUsWeather = unstable_cache(usWeatherUncached, ["signals-nws"], { revalidate: 900 });

export async function fetchSignals(): Promise<Signal[]> {
  return Promise.all([
    fetchUsWeather(),
    fetchSpaceWeather(),
    fetchMississippi(),
    fetchExploitedFlaws(),
    fetchRecalls(),
  ]);
}
