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
import { buildMetrics, fmtPeriod, liveHistory, type Cell, type Metric } from "@/lib/macroCells";
import { WorldMap } from "./WorldMap";
import { TrendChart } from "./TrendChart";

type View = "latest" | "annual";
type Mode = "level" | "change";
type SortKey = { col: string; dir: 1 | -1 };

const GOOD = "#006300";
const BAD = "#c42f2f";
const INK_2 = "#52514e";

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
  const [sort, setSort] = useState<SortKey>({ col: "name", dir: 1 });
  const [playing, setPlaying] = useState(false);
  const mapBox = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

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
  const metric = metrics.find((m) => m.ind.code === indCode) ?? metrics[0];
  const ind = metric.ind;
  const countryByCode = useMemo(() => new Map(data.countries.map((c) => [c.code, c])), [data.countries]);
  const regions = useMemo(() => ["All", ...[...new Set(data.countries.map((c) => c.region))].sort()], [data.countries]);

  function switchView(next: View) {
    setView(next);
    setPlaying(false);
    // Keep the same topic where both views have it.
    const pairs: [string, string][] = [
      ["L_CPI", "PCPIPCH"],
      ["L_GDPQ", "NGDP_RPCH"],
      ["L_UNEMP", "LUR"],
    ];
    const match = pairs.find((p) => p.includes(indCode));
    if (next === "annual") setIndCode(match ? match[1] : indCode.startsWith("L_") ? INDICATORS[0].code : indCode);
    else setIndCode(match ? match[0] : LIVE_INDICATORS.some((i) => i.code === indCode) ? indCode : LIVE_INDICATORS[0].code);
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

  // Biggest movers vs the previous period, among economies over $20B so tiny
  // states' swings don't crowd out the big picture.
  const movers = useMemo(() => {
    const sizeIdx = years.indexOf(projectionFrom) - 1;
    const rows = data.countries
      .filter((c) => (series.NGDPD?.[c.code]?.[sizeIdx] ?? 0) >= 20)
      .map((c) => {
        const cell = cells.get(c.code)!;
        if (cell.fallback) return null;
        const d = change(cell.value, cell.prev, ind);
        if (d == null || Math.abs(d) < 0.005) return null;
        const t = ind.target ?? 0;
        const score =
          ind.polarity === "target"
            ? Math.abs(cell.prev! - t) - Math.abs(cell.value! - t)
            : ind.polarity === "up-bad"
              ? -d
              : d;
        return { c, cell, score };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
    const sorted = [...rows].sort((a, b) => b.score - a.score);
    return { up: sorted.slice(0, 5).filter((r) => r.score > 0), down: sorted.slice(-5).reverse().filter((r) => r.score < 0) };
  }, [data.countries, cells, ind, series, years, projectionFrom]);

  const tableRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data.countries.filter(
      (c) => (region === "All" || c.region === region) && (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q),
    );
    const sortMetric = metrics.find((m) => m.ind.code === sort.col);
    return rows.sort((a, b) => {
      if (!sortMetric) return a.name.localeCompare(b.name) * sort.dir;
      const av = sortMetric.get(a.code).value;
      const bv = sortMetric.get(b.code).value;
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * sort.dir;
    });
  }, [data.countries, region, query, sort, metrics]);

  function select(code: string | null, zoom = false) {
    setSelected(code);
    if (code && zoom) {
      setFocus({ code, nonce: Date.now() });
      mapBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const sel = selected ? countryByCode.get(selected) : null;
  const tooltipEntity = hover && countryByCode.get(hover.code);
  const hoverCell = hover ? cells.get(hover.code) : undefined;
  const fallbackCount = [...cells.values()].filter((c) => c.fallback).length;
  const freshCount = [...cells.values()].filter((c) => c.value != null && !c.fallback).length;
  const failedSources = Object.entries(live.sources).filter(([, s]) => !s.ok);

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

  return (
    <div className="flex flex-col gap-8">
      {/* World at a glance (IMF annual) */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {["NGDP_RPCH", "PCPIPCH", "GGXWDG_NGDP", "NGDPD"].map((code) => {
          const i = INDICATORS.find((x) => x.code === code)!;
          const cell: Cell = {
            value: series[code]?.WEOWORLD?.[yi] ?? null,
            prev: series[code]?.WEOWORLD?.[yi - 1] ?? null,
            period: null,
          };
          return (
            <div key={code} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">
                World · {i.short}, {effectiveYear}
                {effectiveYear >= projectionFrom ? " (IMF forecast)" : ""}
              </div>
              <div className="mt-1 text-2xl font-semibold">{formatValue(cell.value, i)}</div>
              <div className="mt-1 text-xs">
                <Delta cell={cell} ind={i} /> <span className="text-zinc-500">vs {effectiveYear - 1}</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Controls + map */}
      <section ref={mapBox} className="scroll-mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-md border border-zinc-300 text-sm" role="tablist" aria-label="Data view">
            {(["latest", "annual"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => switchView(v)}
                className={`px-3 py-1.5 ${view === v ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100"}`}
              >
                {v === "latest" ? "Latest data" : "Annual & forecasts (IMF)"}
              </button>
            ))}
          </div>
          <span className="text-xs text-zinc-500">
            {view === "latest"
              ? `Each country's most recent release · refreshed daily, last ${fmtPeriod(today)}`
              : `IMF ${data.source}, ${years[1]}–${years[years.length - 1]}`}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Indicator">
          {metrics.map(({ ind: i }) => (
            <button
              key={i.code}
              type="button"
              role="tab"
              aria-selected={i.code === ind.code}
              onClick={() => setIndCode(i.code)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                i.code === ind.code ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
              }`}
            >
              {i.short}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          {view === "annual" && (
            <>
              <div className="flex items-center gap-1">
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
                  className="ml-1 h-8 rounded-md border border-zinc-300 bg-white px-3 hover:bg-zinc-100"
                >
                  {playing ? "❚❚ Pause" : "▶ Play"}
                </button>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs ${year >= projectionFrom ? "bg-amber-100 text-amber-900" : "bg-zinc-100 text-zinc-600"}`}>
                {year >= projectionFrom ? "IMF forecast" : year === projectionFrom - 1 ? "IMF estimate" : "Reported"}
              </span>
            </>
          )}
          <div className="ml-auto flex overflow-hidden rounded-md border border-zinc-300 text-sm">
            {(["level", "change"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1 ${mode === m ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100"}`}
              >
                {m === "level" ? "Level" : view === "annual" ? `Change vs ${year - 1}` : "Change vs previous"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium">
            {ind.label}
            {view === "annual" ? `, ${year}` : ""} <span className="text-sm font-normal text-zinc-500">({ind.unit})</span>
          </h2>
          <p className="text-sm text-zinc-600">{ind.legendNote}</p>
          {view === "latest" && (
            <p className="mt-1 text-xs text-zinc-500">
              {freshCount} countries with a recent release
              {fallbackCount > 0 && (
                <>
                  ; <span className="italic">{fallbackCount} more</span> show the IMF {projectionFrom} forecast instead, because they haven&apos;t
                  published anything more recent
                </>
              )}
              .
            </p>
          )}
        </div>

        <div className="relative">
          <WorldMap
            map={map}
            fill={fill}
            selected={selected}
            focusCode={focus}
            onHover={(code, name, x, y) => setHover(code ? { code, name, x, y } : null)}
            onSelect={(code) => {
              if (code && countryByCode.has(code)) {
                setSelected(code);
                requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
              }
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
                    {ind.short}:{" "}
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
                      #{ranking.pos.get(hover.code)} of {ranking.total} (highest first)
                    </div>
                  )}
                  {hoverCell.source && <div className="text-[11px] text-zinc-400">{hoverCell.source}</div>}
                </>
              ) : (
                <div className="text-xs text-zinc-500">No data</div>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
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
      </section>

      {/* Selected country */}
      <div ref={detailRef} className="scroll-mt-4">
        {sel ? (
          <CountryPanel
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
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
            Click a country on the map or in the table to see its full picture and trends.
          </p>
        )}
      </div>

      {/* Movers */}
      <section className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: ind.code === "L_POLICY" ? "Largest hikes" : ind.polarity === "neutral" ? "Biggest rises" : "Most improved",
            rows: movers.up,
          },
          {
            title: ind.code === "L_POLICY" ? "Largest cuts" : ind.polarity === "neutral" ? "Biggest falls" : "Most deteriorated",
            rows: movers.down,
          },
        ].map((box) => (
          <div key={box.title} className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-medium">
              {box.title}: {ind.short}
              {view === "annual" ? `, ${year - 1}→${year}` : ind.code === "L_POLICY" ? ", past 12 months" : ", latest vs previous release"}
            </h3>
            <p className="text-xs text-zinc-500">Economies over $20B</p>
            {box.rows.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">None.</p>
            ) : (
              <ol className="mt-2 flex flex-col gap-1 text-sm">
                {box.rows.map((r) => (
                  <li key={r.c.code} className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => select(r.c.code, true)} className="truncate text-left hover:underline">
                      {r.c.name}
                    </button>
                    <span className="flex gap-3 tabular-nums">
                      <span className="hidden text-zinc-500 sm:inline">
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
      </section>

      {/* Aggregates (IMF annual in both views) */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">
          Regions and groups, {effectiveYear}
          {effectiveYear >= projectionFrom ? " (IMF forecast)" : ""}
        </h2>
        <p className="text-sm text-zinc-600">
          IMF totals for the world and major groupings. Green ▲/▼ = better than {effectiveYear - 1}, red = worse.
        </p>
        <DataTable
          rows={data.aggregates.map((code) => ({ code, name: AGGREGATES.find((a) => a.code === code)?.label ?? code }))}
          metrics={annualMetrics}
          highlight={view === "annual" ? indCode : ""}
          scroll={false}
        />
      </section>

      {/* All countries */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">All countries{view === "annual" ? `, ${year}` : ", latest data"}</h2>
        {view === "latest" && (
          <p className="text-sm text-zinc-600">
            Small gray text under each value is the period it covers. <span className="italic text-zinc-500">Gray italics</span> = no recent
            release, IMF {projectionFrom} forecast shown instead. Arrows compare with the previous release (policy rate: the last move;
            currency: since the last month-end).
          </p>
        )}
        <div className="flex flex-wrap gap-2 text-sm">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a country…"
            className="h-8 w-48 rounded-md border border-zinc-300 bg-white px-2 outline-none focus:border-zinc-500"
          />
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="h-8 rounded-md border border-zinc-300 bg-white px-2" aria-label="Region">
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <span className="self-center text-xs text-zinc-500">{tableRows.length} countries · click a column to sort, a row to open it</span>
        </div>
        <DataTable
          rows={tableRows}
          metrics={metrics}
          highlight={indCode}
          sort={sort}
          onSort={(col) => setSort((s) => (s.col === col ? { col, dir: (s.dir * -1) as 1 | -1 } : { col, dir: col === "name" ? 1 : -1 }))}
          onRow={(code) => select(code, true)}
          selected={selected}
          showPeriod={view === "latest"}
        />
      </section>

      {view === "latest" && failedSources.length > 0 && (
        <p className="text-xs text-zinc-500">
          Not refreshed on the last run (showing earlier figures): {failedSources.map(([k]) => k).join(", ")}.
        </p>
      )}
    </div>
  );
}

function CountryPanel({
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
  country: { code: string; name: string; region: string };
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
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">
          {country.name} <span className="text-sm font-normal text-zinc-500">{country.region}</span>
        </h2>
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={onZoom} className="text-zinc-600 underline hover:text-zinc-900">
            Zoom map here
          </button>
          <button type="button" onClick={onClose} className="text-zinc-600 underline hover:text-zinc-900">
            Close
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(({ ind: i, get }) => {
          const cell = get(country.code);
          const isLive = i.code.startsWith("L_");
          let chart: React.ReactNode;
          if (isLive) {
            const h = liveHistory(i.code, country.code, live);
            const isFx = i.code === "L_FX";
            chart =
              h && !cell.fallback ? (
                <TrendChart
                  label={i.label}
                  labels={h.labels}
                  values={h.values}
                  highlight={h.values.length - 1}
                  forecastFrom={null}
                  zeroBase={i.code === "L_CPI" || i.code === "L_GDPQ"}
                  fmt={(v) =>
                    v == null ? "–" : isFx ? `${v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toPrecision(4)} per $` : `${v.toFixed(2)}%`
                  }
                />
              ) : (
                <p className="py-8 text-center text-xs text-zinc-500">
                  {cell.fallback ? "No recent monthly or quarterly release" : "No data"}
                </p>
              );
          } else {
            chart = (
              <TrendChart
                label={i.label}
                labels={labels}
                values={series[i.code]?.[country.code] ?? years.map(() => null)}
                world={i.format === "pct" ? series[i.code]?.WEOWORLD : undefined}
                highlight={view === "latest" ? forecastIdx : yi}
                forecastFrom={forecastIdx}
                zeroBase={i.format === "pct"}
                fmt={(v) => formatValue(v, i)}
              />
            );
          }
          return (
            <div key={i.code} className="flex flex-col gap-1">
              <div className="text-xs text-zinc-500">{i.label}</div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-lg font-semibold">
                  <ValueCell cell={cell} ind={i} />
                </span>
                <span className="text-xs">
                  <Delta cell={cell} ind={i} withNote={view === "latest"} />
                </span>
              </div>
              {cell.value != null && (cell.period || cell.detail) && (
                <div className="text-[11px] text-zinc-500">{[cell.period, cell.detail, cell.source].filter(Boolean).join(" · ")}</div>
              )}
              {chart}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {view === "latest"
          ? "Charts show the last two years of releases (for the currency: local units per US dollar at each month-end, then today). Gray italic values are IMF annual forecasts, used where no recent release exists."
          : `Blue line: ${country.name}; dotted gray: world. Shaded area and dashed line are IMF forecasts.`}
      </p>
    </section>
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
  scroll = true,
  showPeriod = false,
}: {
  rows: { code: string; name: string }[];
  metrics: Metric[];
  highlight: string;
  sort?: SortKey;
  onSort?: (col: string) => void;
  onRow?: (code: string) => void;
  selected?: string | null;
  scroll?: boolean;
  showPeriod?: boolean;
}) {
  const header = (col: string, label: string, right = true) => (
    <th
      key={col}
      scope="col"
      aria-sort={sort?.col === col ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
      className={`px-2 py-2 font-medium ${right ? "text-right" : "text-left"} ${col === highlight ? "bg-zinc-100" : ""}`}
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
    <div className={`relative overflow-auto rounded-lg ${scroll ? "max-h-[36rem]" : ""} border border-zinc-200 bg-white`}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-white text-xs text-zinc-600 shadow-[0_1px_0_#e4e4e7]">
          <tr>
            {header("name", "Country / group", false)}
            {metrics.map((m) => header(m.ind.code, m.ind.short))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.code}
              onClick={onRow ? () => onRow(r.code) : undefined}
              className={`border-t border-zinc-100 ${onRow ? "cursor-pointer hover:bg-zinc-50" : ""} ${selected === r.code ? "bg-blue-50" : ""}`}
            >
              <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-left font-medium">
                {r.name}
              </th>
              {metrics.map((m) => {
                const cell = m.get(r.code);
                return (
                  <td key={m.ind.code} className={`px-2 py-1.5 text-right align-top ${m.ind.code === highlight ? "bg-zinc-50" : ""}`}>
                    <div>
                      <ValueCell cell={cell} ind={m.ind} />
                    </div>
                    <div className="text-[11px]">
                      <Delta cell={cell} ind={m.ind} />
                    </div>
                    {showPeriod && cell.value != null && cell.period && (
                      <div className="whitespace-nowrap text-[10px] text-zinc-400">
                        {cell.period.replace(/^(\d{4}) IMF forecast$/, "IMF $1F")}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
