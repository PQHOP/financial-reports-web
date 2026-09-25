"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AGGREGATES,
  CHANGE_LEGEND,
  INDICATORS,
  LIVE_INDICATORS,
  NO_DATA,
  change,
  changeColor,
  changeDecimals,
  formatChange,
  formatValue,
  levelColor,
  verdict,
  type Indicator,
  type MacroData,
  type MapData,
} from "@/lib/macro";
import type { LiveData } from "@/lib/macroLive";
import { buildMetrics, liveHistory, type Cell, type Metric } from "@/lib/macroCells";
import { WorldMap } from "./WorldMap";
import { TrendChart } from "./TrendChart";

type View = "latest" | "annual";
type Mode = "level" | "change";
type SortKey = { col: string; dir: 1 | -1 };
type Country = MacroData["countries"][number];

const GOOD = "#006300";
const BAD = "#c42f2f";
const INK_2 = "#52514e";
const PAGE_SIZE = 40;
// Economies smaller than this ($ billions) are left out of "movers" lists,
// where tiny states' swings would crowd out the big picture.
const MOVER_MIN_GDP = 20;

function Delta({ cell, ind, withNote = false }: { cell: Cell; ind: Indicator; withNote?: boolean }) {
  const d = change(cell.value, cell.prev, ind);
  if (d == null) return <span className="text-zinc-400">–</span>;
  const v = verdict(cell.value, cell.prev, ind);
  // A move that rounds to zero at the displayed precision is shown as flat.
  const flat = Number(Math.abs(d).toFixed(changeDecimals(ind))) === 0;
  const arrow = flat ? "■" : d > 0 ? "▲" : "▼";
  const color = flat ? INK_2 : v > 0 ? GOOD : v < 0 ? BAD : INK_2;
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span style={{ color }}>
        <span aria-hidden className="mr-0.5 text-[0.7em]">
          {arrow}
        </span>
        {formatChange(d, ind)}
      </span>
      <span className="sr-only">{v > 0 ? " (better)" : v < 0 ? " (worse)" : ""}</span>
      {withNote && cell.deltaNote && <span className="text-zinc-500"> {cell.deltaNote}</span>}
    </span>
  );
}

function ValueCell({ cell, ind }: { cell: Cell; ind: Indicator }) {
  return (
    <span className={`tabular-nums ${cell.fallback ? "italic text-zinc-500" : ""}`}>{formatValue(cell.value, ind)}</span>
  );
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-zinc-300 text-sm" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap px-3 py-1.5 ${value === o.value ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EconomyDashboard({
  data,
  live,
  map,
  initial,
}: {
  data: MacroData;
  live: LiveData;
  map: MapData;
  initial: { view: View; indicator: string; year: number; country: string | null };
}) {
  const { years, series } = data;
  const projectionFrom = Number(data.source.match(/(\d{4})/)?.[1] ?? years[years.length - 1]);
  const today = live.updatedAt.slice(0, 10);
  const [view, setView] = useState<View>(initial.view);
  const [indCode, setIndCode] = useState(initial.indicator);
  const [year, setYear] = useState(initial.year);
  const [mode, setMode] = useState<Mode>("level");
  const [selected, setSelected] = useState<string | null>(initial.country);
  const [focus, setFocus] = useState<{ code: string; nonce: number } | null>(null);
  const [hover, setHover] = useState<{ code: string; name: string; x: number; y: number } | null>(null);
  const [region, setRegion] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>({ col: "size", dir: -1 });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [playing, setPlaying] = useState(false);
  const mapBox = useRef<HTMLDivElement>(null);

  const effectiveYear = view === "latest" ? projectionFrom : year;
  const yi = years.indexOf(effectiveYear);
  const metrics = useMemo(
    () => buildMetrics({ view, weo: data, live, yi, projectionFrom, today }),
    [view, data, live, yi, projectionFrom, today],
  );
  const annualMetrics = useMemo(
    () => buildMetrics({ view: "annual", weo: data, live, yi, projectionFrom, today }),
    [data, live, yi, projectionFrom, today],
  );
  const liveMetrics = useMemo(
    () => (view === "latest" ? metrics : buildMetrics({ view: "latest", weo: data, live, yi, projectionFrom, today })),
    [view, metrics, data, live, yi, projectionFrom, today],
  );
  const metric = metrics.find((m) => m.ind.code === indCode) ?? metrics[0];
  const ind = metric.ind;
  const countryByCode = useMemo(() => new Map(data.countries.map((c) => [c.code, c])), [data.countries]);
  const regions = useMemo(() => ["All", ...[...new Set(data.countries.map((c) => c.region))].sort()], [data.countries]);
  // Size of each economy (last IMF estimate), for default ordering and movers.
  const gdpSize = useMemo(() => {
    const idx = years.indexOf(projectionFrom) - 1;
    return new Map(data.countries.map((c) => [c.code, series.NGDPD?.[c.code]?.[idx] ?? 0]));
  }, [data.countries, series, years, projectionFrom]);

  function switchView(next: View) {
    if (next === view) return;
    setView(next);
    setPlaying(false);
    // Keep the same topic where both views have it.
    const pairs: [string, string][] = [
      ["L_CPI", "PCPIPCH"],
      ["L_GDPQ", "NGDP_RPCH"],
      ["L_UNEMP", "LUR"],
      ["GGXWDG_NGDP", "GGXWDG_NGDP"],
    ];
    const match = pairs.find((p) => p.includes(indCode));
    if (next === "annual") setIndCode(match ? match[1] : INDICATORS[0].code);
    else setIndCode(match ? match[0] : LIVE_INDICATORS[0].code);
    if (sort.col !== "size" && sort.col !== "name") setSort({ col: "size", dir: -1 });
  }

  // Keep the URL shareable without adding history entries.
  useEffect(() => {
    const p = new URLSearchParams();
    if (view === "annual") p.set("view", "annual");
    p.set("indicator", indCode);
    if (view === "annual" && year !== projectionFrom) p.set("year", String(year));
    if (selected) p.set("country", selected);
    window.history.replaceState(null, "", `?${p.toString()}`);
  }, [view, indCode, year, selected, projectionFrom]);

  // "Play" steps through the years on the map (annual view).
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setYear((y) => {
        if (y >= years[years.length - 1]) {
          setPlaying(false);
          return y;
        }
        return y + 1;
      });
    }, 700);
    return () => clearInterval(t);
  }, [playing, years]);

  // Escape closes the country panel (a bottom sheet on phones).
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const cells = useMemo(() => {
    const m = new Map<string, Cell>();
    for (const c of data.countries) m.set(c.code, metric.get(c.code));
    return m;
  }, [data.countries, metric]);

  const fill = (code: string) => {
    const cell = cells.get(code);
    if (!cell) return NO_DATA;
    return mode === "level" ? levelColor(cell.value, ind) : changeColor(cell.value, cell.prev, ind);
  };

  const ranking = useMemo(() => {
    const vals = [...cells.entries()].filter(([, c]) => c.value != null).sort((a, b) => b[1].value! - a[1].value!);
    return { pos: new Map(vals.map(([code], i) => [code, i + 1])), total: vals.length };
  }, [cells]);

  const movers = useMemo(() => {
    const rows = data.countries
      .filter((c) => (gdpSize.get(c.code) ?? 0) >= MOVER_MIN_GDP)
      .map((c) => {
        const cell = cells.get(c.code)!;
        if (cell.fallback) return null;
        const d = change(cell.value, cell.prev, ind);
        if (d == null || Number(Math.abs(d).toFixed(changeDecimals(ind))) === 0) return null;
        const t = ind.target ?? 0;
        const score =
          ind.polarity === "target" ? Math.abs(cell.prev! - t) - Math.abs(cell.value! - t) : ind.polarity === "up-bad" ? -d : d;
        return { c, cell, score };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
    const sorted = [...rows].sort((a, b) => b.score - a.score);
    return { up: sorted.slice(0, 5).filter((r) => r.score > 0), down: sorted.slice(-5).reverse().filter((r) => r.score < 0) };
  }, [data.countries, cells, ind, gdpSize]);

  const moverTitles =
    ind.code === "L_POLICY"
      ? ["Rate hikes", "Rate cuts"]
      : ind.polarity === "target"
        ? [`Moving toward ~${ind.target}%`, `Moving away from ~${ind.target}%`]
        : ind.polarity === "neutral"
          ? ["Biggest rises", "Biggest falls"]
          : ["Most improved", "Most deteriorated"];

  const tableRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data.countries.filter(
      (c) => (region === "All" || c.region === region) && (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q),
    );
    const sortMetric = metrics.find((m) => m.ind.code === sort.col);
    const key = (c: Country): number | null =>
      sort.col === "size" ? (gdpSize.get(c.code) ?? null) : sortMetric ? sortMetric.get(c.code).value : null;
    return rows.sort((a, b) => {
      if (sort.col === "name") return a.name.localeCompare(b.name) * sort.dir;
      const av = key(a);
      const bv = key(b);
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * sort.dir;
    });
  }, [data.countries, region, query, sort, metrics, gdpSize]);
  const shownRows = query.trim() ? tableRows : tableRows.slice(0, limit);

  function select(code: string | null, zoom = false) {
    setSelected(code);
    if (code && zoom) {
      setFocus((f) => ({ code, nonce: (f?.nonce ?? 0) + 1 }));
      mapBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const sel = selected ? countryByCode.get(selected) : null;
  const tooltipEntity = hover && countryByCode.get(hover.code);
  const hoverCell = hover ? cells.get(hover.code) : undefined;
  const fallbackCount = [...cells.values()].filter((c) => c.fallback).length;
  const freshCount = [...cells.values()].filter((c) => c.value != null && !c.fallback).length;
  const failedSources = Object.entries(live.sources).filter(([, s]) => !s.ok);

  // --- headline tiles -------------------------------------------------------
  const tiles = useMemo(() => {
    if (view === "annual") {
      return ["NGDP_RPCH", "PCPIPCH", "GGXWDG_NGDP", "NGDPD"].map((code) => {
        const i = INDICATORS.find((x) => x.code === code)!;
        const cell: Cell = { value: series[code]?.WEOWORLD?.[yi] ?? null, prev: series[code]?.WEOWORLD?.[yi - 1] ?? null, period: null };
        return {
          key: code,
          label: `World ${i.short.toLowerCase().replace("gdp", "GDP")}, ${effectiveYear}${effectiveYear >= projectionFrom ? " (forecast)" : ""}`,
          value: formatValue(cell.value, i),
          sub: (
            <>
              <Delta cell={cell} ind={i} /> <span className="text-zinc-500">vs {effectiveYear - 1}</span>
            </>
          ),
          target: code,
        };
      });
    }
    const get = (code: string) => liveMetrics.find((m) => m.ind.code === code)!;
    const freshValues = (code: string) =>
      data.countries
        .map((c) => get(code).get(c.code))
        .filter((c) => c.value != null && !c.fallback)
        .map((c) => c.value!);
    const cpi = freshValues("L_CPI");
    const gdp = freshValues("L_GDPQ");
    // Central bank decisions in the last ~3 months; the ECB counts once.
    let hikes = 0;
    let cuts = 0;
    const cutoff = new Date(Date.parse(today) - 92 * 86400_000).toISOString().slice(0, 10);
    const seen = new Set<string>();
    for (const [code, s] of Object.entries(live.metrics.policy ?? {})) {
      const ch = s.lastChange;
      if (!ch || (ch.period.length === 7 ? `${ch.period}-31` : ch.period) < cutoff) continue;
      const bank = s.source.includes("European Central Bank") ? "ECB" : code;
      if (seen.has(bank)) continue;
      seen.add(bank);
      if (ch.to > ch.from) hikes++;
      else if (ch.to < ch.from) cuts++;
    }
    const fx = data.countries
      .filter((c) => (gdpSize.get(c.code) ?? 0) >= MOVER_MIN_GDP)
      .map((c) => ({ c, v: get("L_FX").get(c.code).value }))
      .filter((r): r is { c: Country; v: number } => r.v != null)
      .sort((a, b) => b.v - a.v);
    const pct = (v: number | null, signed = false) =>
      v == null ? "–" : `${signed && v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
    return [
      {
        key: "cpi",
        label: `Typical inflation now (median of ${cpi.length})`,
        value: pct(median(cpi)),
        sub: <span className="text-zinc-500">{cpi.filter((v) => v > 5).length} countries above 5%</span>,
        target: "L_CPI",
      },
      {
        key: "gdp",
        label: `Typical GDP growth, latest quarter (${gdp.length})`,
        value: pct(median(gdp)),
        sub: <span className="text-zinc-500">{gdp.filter((v) => v < 0).length} economies shrinking</span>,
        target: "L_GDPQ",
      },
      {
        key: "cb",
        label: "Central bank moves, last 3 months",
        value: `${hikes} up · ${cuts} down`,
        sub: <span className="text-zinc-500">Euro area counted once</span>,
        target: "L_POLICY",
      },
      {
        key: "fx",
        label: `Strongest currency vs US$ this year${fx.length ? `: ${fx[0].c.name}` : ""}`,
        value: fx.length ? pct(fx[0].v, true) : "–",
        sub: fx.length ? (
          <span className="text-zinc-500">
            Weakest: {fx[fx.length - 1].c.name} {pct(fx[fx.length - 1].v, true)}
          </span>
        ) : null,
        target: "L_FX",
      },
    ];
  }, [view, series, yi, effectiveYear, projectionFrom, liveMetrics, data.countries, live.metrics.policy, today, gdpSize]);

  const legend =
    mode === "level"
      ? ind.colors.map((color, i) => ({
          color,
          label:
            i === 0
              ? `< ${formatValue(ind.breaks[0], ind)}`
              : i === ind.colors.length - 1
                ? `≥ ${formatValue(ind.breaks[i - 1], ind)}`
                : `${formatValue(ind.breaks[i - 1], ind)} to ${formatValue(ind.breaks[i], ind)}`,
        }))
      : null;

  const moversBlock = (
    <div className="flex flex-col gap-4">
      {[
        { title: moverTitles[0], rows: movers.up },
        { title: moverTitles[1], rows: movers.down },
      ].map((box) => (
        <div key={box.title} className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-medium">{box.title}</h3>
          <p className="text-xs text-zinc-500">
            {ind.short}, {view === "annual" ? `${year - 1}→${year}` : ind.code === "L_POLICY" ? "last move within a year" : "latest vs previous release"}
            {" · "}economies over ${MOVER_MIN_GDP}B
          </p>
          {box.rows.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">None.</p>
          ) : (
            <ol className="mt-2 flex flex-col gap-1 text-sm">
              {box.rows.map((r) => (
                <li key={r.c.code} className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => select(r.c.code, true)} className="truncate text-left hover:underline">
                    {r.c.name}
                  </button>
                  <span className="flex shrink-0 gap-2 text-xs tabular-nums">
                    <span className="text-zinc-500">
                      {formatValue(r.cell.prev, ind)} → {formatValue(r.cell.value, ind)}
                    </span>
                    <Delta cell={r.cell} ind={ind} />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
      <p className="hidden text-center text-xs text-zinc-500 lg:block">Click a country on the map or in the table for its details.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Headline tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Headlines">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setIndCode(t.target);
              mapBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`min-w-0 rounded-lg border bg-white p-3 text-left transition hover:border-zinc-400 sm:p-4 ${
              indCode === t.target ? "border-zinc-900" : "border-zinc-200"
            }`}
          >
            <div className="text-xs text-zinc-500">{t.label}</div>
            <div className="mt-1 truncate text-lg font-semibold sm:text-2xl">{t.value}</div>
            <div className="mt-1 truncate text-xs">{t.sub}</div>
          </button>
        ))}
      </section>

      {/* Toolbar (sticks while scrolling so the table can be re-pivoted) */}
      <div className="sticky top-0 z-30 -mx-2 flex flex-col gap-2 border-b border-zinc-200 bg-white/95 px-2 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Data view"
            value={view}
            onChange={switchView}
            options={[
              { value: "latest", label: "Latest" },
              { value: "annual", label: "Annual & forecasts" },
            ]}
          />
          <div
            className="order-last -mx-2 flex w-[calc(100%+1rem)] gap-1.5 overflow-x-auto px-2 pb-0.5 lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:flex-wrap lg:overflow-visible lg:px-0"
            role="tablist"
            aria-label="Indicator"
          >
            {metrics.map(({ ind: i }) => (
              <button
                key={i.code}
                type="button"
                role="tab"
                aria-selected={i.code === ind.code}
                onClick={() => setIndCode(i.code)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm transition ${
                  i.code === ind.code ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
                }`}
              >
                {i.short}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <Segmented
              label="Map coloring"
              value={mode}
              onChange={setMode}
              options={[
                { value: "level", label: "Level" },
                { value: "change", label: "Change" },
              ]}
            />
          </div>
        </div>
        {view === "annual" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" aria-label="Previous year" onClick={() => setYear((y) => Math.max(years[1], y - 1))} className="h-8 w-8 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100">
              ‹
            </button>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 tabular-nums"
              aria-label="Year"
            >
              {years.slice(1).map((y) => (
                <option key={y} value={y}>
                  {y}
                  {y >= projectionFrom ? " (forecast)" : ""}
                </option>
              ))}
            </select>
            <button type="button" aria-label="Next year" onClick={() => setYear((y) => Math.min(years[years.length - 1], y + 1))} className="h-8 w-8 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100">
              ›
            </button>
            <button
              type="button"
              onClick={() => {
                if (!playing && year >= years[years.length - 1]) setYear(years[1]);
                setPlaying((p) => !p);
              }}
              className="h-8 rounded-md border border-zinc-300 bg-white px-3 hover:bg-zinc-100"
            >
              {playing ? "❚❚ Pause" : "▶ Play"}
            </button>
            <span className={`rounded px-2 py-0.5 text-xs ${year >= projectionFrom ? "bg-amber-100 text-amber-900" : "bg-zinc-100 text-zinc-600"}`}>
              {year >= projectionFrom ? "IMF forecast" : year === projectionFrom - 1 ? "IMF estimate" : "Reported"}
            </span>
          </div>
        )}
      </div>

      {/* Map + side panel */}
      <section ref={mapBox} className="scroll-mt-28 grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-2 lg:col-span-2">
          <div>
            <h2 className="text-lg font-medium">
              {ind.label}
              {view === "annual" ? `, ${year}` : ""} <span className="text-sm font-normal text-zinc-500">({ind.unit})</span>
            </h2>
            <p className="text-sm text-zinc-600">
              {ind.legendNote}
              {view === "latest" && fallbackCount > 0 && (
                <span className="text-zinc-500">
                  {" "}
                  {freshCount} countries have a recent release; {fallbackCount} show the IMF {projectionFrom} forecast instead.
                </span>
              )}
            </p>
          </div>
          <div className="relative">
            <WorldMap
              map={map}
              fill={fill}
              selected={selected}
              focusCode={focus}
              onHover={(code, name, x, y) => setHover(code ? { code, name, x, y } : null)}
              onSelect={(code) => {
                if (code && countryByCode.has(code)) setSelected(code);
              }}
            />
            {hover && (
              <div
                className="pointer-events-none fixed z-50 min-w-48 max-w-72 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-lg"
                style={{ left: hover.x + 14, top: hover.y + 14 }}
              >
                <div className="font-medium">{tooltipEntity?.name ?? hover.name}</div>
                {tooltipEntity && hoverCell && hoverCell.value != null ? (
                  <>
                    <div className="tabular-nums">
                      <span className="font-semibold">
                        <ValueCell cell={hoverCell} ind={ind} />
                      </span>
                      {hoverCell.period && <span className="text-xs text-zinc-500"> · {hoverCell.period}</span>}
                    </div>
                    <div className="text-xs">
                      <Delta cell={hoverCell} ind={ind} withNote />
                    </div>
                    {hoverCell.detail && <div className="text-xs text-zinc-500">{hoverCell.detail}</div>}
                    {ranking.pos.get(hover.code) && (
                      <div className="text-xs text-zinc-500">
                        #{ranking.pos.get(hover.code)} of {ranking.total}, highest first
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-zinc-500">No data</div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
            {legend ? (
              legend.map((l) => (
                <span key={l.label} className="flex items-center gap-1 tabular-nums">
                  <span className="inline-block h-3 w-5 rounded-sm" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))
            ) : (
              <span className="flex items-center gap-2">
                {ind.polarity === "neutral" ? "fell" : "worse"}
                <span className="flex">
                  {CHANGE_LEGEND.map((c) => (
                    <span key={c} className="inline-block h-3 w-5" style={{ background: c }} />
                  ))}
                </span>
                {ind.polarity === "neutral" ? "rose" : "better"}
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-5 rounded-sm border border-zinc-300" style={{ background: NO_DATA }} />
              no data
            </span>
          </div>
        </div>

        <aside className="min-w-0 lg:max-h-[40rem] lg:overflow-y-auto">
          {sel && (
            <>
              {/* Phones: bottom sheet over the page. Desktop: fills the side column. */}
              <button
                type="button"
                aria-label="Close country details"
                onClick={() => setSelected(null)}
                className="fixed inset-0 z-40 bg-black/20 lg:hidden"
              />
              <div className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-zinc-200 bg-white p-4 shadow-2xl lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:rounded-lg lg:border lg:shadow-none">
                <CountryCard
                  country={sel}
                  view={view}
                  metrics={metrics}
                  data={data}
                  live={live}
                  yi={yi}
                  projectionFrom={projectionFrom}
                  onZoom={() => select(sel.code, true)}
                  onClose={() => setSelected(null)}
                />
              </div>
            </>
          )}
          <div className={sel ? "lg:hidden" : ""}>{moversBlock}</div>
        </aside>
      </section>

      {/* All countries */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-medium">All countries{view === "annual" ? `, ${year}` : ", latest data"}</h2>
          <p className="text-xs text-zinc-500">
            {view === "latest" ? (
              <>
                Gray text = period covered · <span className="italic">italics</span> = IMF {projectionFrom} forecast (no recent release)
              </>
            ) : (
              <>Change vs {year - 1}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a country…"
            className="h-8 w-44 rounded-md border border-zinc-300 bg-white px-2 outline-none focus:border-zinc-500"
          />
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="h-8 rounded-md border border-zinc-300 bg-white px-2" aria-label="Region">
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            value={sort.col === "size" || sort.col === "name" ? sort.col : "col"}
            onChange={(e) => {
              const v = e.target.value;
              setSort(v === "col" ? { col: indCode, dir: -1 } : { col: v, dir: v === "name" ? 1 : -1 });
            }}
            className="h-8 rounded-md border border-zinc-300 bg-white px-2"
            aria-label="Sort"
          >
            <option value="size">Largest economies first</option>
            <option value="name">A–Z</option>
            <option value="col">By {ind.short}, high to low</option>
          </select>
        </div>
        <DataTable
          rows={shownRows}
          metrics={metrics}
          highlight={indCode}
          sort={sort}
          onSort={(col) => setSort((s) => (s.col === col ? { col, dir: (s.dir * -1) as 1 | -1 } : { col, dir: col === "name" ? 1 : -1 }))}
          onRow={(code) => select(code, true)}
          selected={selected}
          showPeriod={view === "latest"}
        />
        {shownRows.length < tableRows.length && (
          <button
            type="button"
            onClick={() => setLimit(tableRows.length)}
            className="self-center rounded-md border border-zinc-300 bg-white px-4 py-1.5 text-sm hover:bg-zinc-100"
          >
            Show all {tableRows.length} countries
          </button>
        )}
      </section>

      {/* Regions and groups (IMF annual) */}
      <details className="rounded-lg border border-zinc-200 bg-white">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          Regions and groups, {effectiveYear}
          {effectiveYear >= projectionFrom ? " (IMF forecast)" : ""}
          <span className="ml-2 font-normal text-zinc-500">World, G7, euro area, emerging markets and more</span>
        </summary>
        <div className="px-2 pb-2">
          <DataTable
            rows={data.aggregates.map((code) => ({ code, name: AGGREGATES.find((a) => a.code === code)?.label ?? code }))}
            metrics={annualMetrics}
            highlight={view === "annual" ? indCode : ""}
          />
        </div>
      </details>

      {view === "latest" && failedSources.length > 0 && (
        <p className="text-xs text-zinc-500">
          Not refreshed on the last run (showing earlier figures): {failedSources.map(([k]) => k).join(", ")}.
        </p>
      )}
    </div>
  );
}

function CountryCard({
  country,
  view,
  metrics,
  data,
  live,
  yi,
  projectionFrom,
  onZoom,
  onClose,
}: {
  country: Country;
  view: View;
  metrics: Metric[];
  data: MacroData;
  live: LiveData;
  yi: number;
  projectionFrom: number;
  onZoom: () => void;
  onClose: () => void;
}) {
  const { years, series } = data;
  const labels = years.map(String);
  const forecastIdx = years.indexOf(projectionFrom);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold leading-tight">{country.name}</h2>
          <p className="text-xs text-zinc-500">{country.region}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <button type="button" onClick={onZoom} className="text-zinc-600 underline hover:text-zinc-900">
            Zoom map
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 rounded-md border border-zinc-300 text-zinc-600 hover:bg-zinc-100">
            ✕
          </button>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-zinc-100">
        {metrics.map(({ ind: i, get }) => {
          const cell = get(country.code);
          const isLive = i.code.startsWith("L_");
          let chart: React.ReactNode = null;
          if (isLive) {
            const h = liveHistory(i.code, country.code, live);
            const isFx = i.code === "L_FX";
            if (h && !cell.fallback) {
              chart = (
                <TrendChart
                  label={i.label}
                  labels={h.labels}
                  values={h.values}
                  highlight={h.values.length - 1}
                  forecastFrom={null}
                  zeroBase={i.code === "L_CPI" || i.code === "L_GDPQ"}
                  height={64}
                  fmt={(v) =>
                    v == null ? "–" : isFx ? `${v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toPrecision(4)}/$` : `${v.toFixed(2)}%`
                  }
                />
              );
            }
          } else if (series[i.code]?.[country.code]) {
            chart = (
              <TrendChart
                label={i.label}
                labels={labels}
                values={series[i.code][country.code]}
                world={i.format === "pct" ? series[i.code]?.WEOWORLD : undefined}
                highlight={view === "latest" ? forecastIdx : yi}
                forecastFrom={forecastIdx}
                zeroBase={i.format === "pct"}
                height={64}
                fmt={(v) => formatValue(v, i)}
              />
            );
          }
          return (
            <li key={i.code} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs text-zinc-500">{i.label}</div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-base font-semibold">
                    <ValueCell cell={cell} ind={i} />
                  </span>
                  {cell.value != null && (
                    <span className="text-xs">
                      <Delta cell={cell} ind={i} />
                    </span>
                  )}
                </div>
                {cell.value != null && (cell.period || cell.detail) && (
                  <div className="truncate text-[11px] text-zinc-500" title={[cell.period, cell.detail, cell.source].filter(Boolean).join(" · ")}>
                    {[cell.period, cell.detail].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div>{chart ?? <p className="text-center text-[11px] text-zinc-400">{cell.fallback ? "No recent release" : "No data"}</p>}</div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-zinc-500">
        {view === "latest"
          ? "Charts: last two years of releases; currency as local units per US$. Italic values are IMF annual forecasts."
          : "Dotted gray: world. Shaded part: IMF forecast."}
      </p>
    </div>
  );
}

function DataTable({
  rows,
  metrics,
  highlight,
  sort,
  onSort,
  onRow,
  selected,
  showPeriod = false,
}: {
  rows: { code: string; name: string }[];
  metrics: Metric[];
  highlight: string;
  sort?: SortKey;
  onSort?: (col: string) => void;
  onRow?: (code: string) => void;
  selected?: string | null;
  showPeriod?: boolean;
}) {
  const header = (col: string, label: string, first = false) => (
    <th
      key={col}
      scope="col"
      aria-sort={sort?.col === col ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
      className={`whitespace-nowrap px-2 py-2 font-medium ${first ? "sticky left-0 z-[2] bg-white text-left" : "text-right"} ${
        col === highlight ? "bg-zinc-100" : ""
      }`}
    >
      {onSort ? (
        <button type="button" onClick={() => onSort(col)} className="hover:underline">
          {label}
          {sort?.col === col && <span aria-hidden>{sort.dir === 1 ? " ↑" : " ↓"}</span>}
        </button>
      ) : (
        label
      )}
    </th>
  );
  return (
    <div className="relative overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead className="text-xs text-zinc-600">
          <tr className="border-b border-zinc-200">
            {header("name", "Country", true)}
            {metrics.map((m) => header(m.ind.code, m.ind.short))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rowBg = selected === r.code ? "bg-blue-50" : "bg-white group-hover:bg-zinc-50";
            return (
              <tr key={r.code} onClick={onRow ? () => onRow(r.code) : undefined} className={`group border-t border-zinc-100 ${onRow ? "cursor-pointer" : ""}`}>
                <th scope="row" className={`sticky left-0 z-[1] max-w-[8.5rem] truncate px-2 py-1.5 text-left font-medium sm:max-w-none ${rowBg}`}>
                  {r.name}
                </th>
                {metrics.map((m) => {
                  const cell = m.get(r.code);
                  return (
                    <td
                      key={m.ind.code}
                      className={`whitespace-nowrap px-2 py-1.5 text-right align-top ${m.ind.code === highlight ? "bg-zinc-50" : rowBg}`}
                    >
                      {cell.value == null ? (
                        <span className="text-zinc-300">–</span>
                      ) : (
                        <div>
                          <ValueCell cell={cell} ind={m.ind} />{" "}
                          <span className="text-[11px]">
                            <Delta cell={cell} ind={m.ind} />
                          </span>
                        </div>
                      )}
                      {showPeriod && cell.value != null && cell.period && (
                        <div className="text-[10px] leading-tight text-zinc-400">
                          {cell.period.replace(/^(\d{4}) IMF forecast$/, "IMF $1F").replace(/, \d{4}$/, "")}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
