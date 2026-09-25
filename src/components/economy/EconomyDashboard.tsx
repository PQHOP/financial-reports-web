"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AGGREGATES,
  CHANGE_LEGEND,
  INDICATORS,
  NO_DATA,
  change,
  changeColor,
  formatChange,
  formatValue,
  levelColor,
  verdict,
  type Indicator,
  type MacroData,
  type MapData,
} from "@/lib/macro";
import { WorldMap } from "./WorldMap";
import { TrendChart } from "./TrendChart";

type Mode = "level" | "change";
type SortKey = { col: "name" | string; dir: 1 | -1 };

const GOOD = "#006300";
const BAD = "#c42f2f";
const INK_2 = "#52514e";

function Delta({ cur, prev, ind }: { cur: number | null; prev: number | null; ind: Indicator }) {
  const d = change(cur, prev, ind);
  if (d == null) return <span className="text-zinc-400">–</span>;
  const v = verdict(cur, prev, ind);
  const arrow = Math.abs(d) < 0.05 ? "■" : d > 0 ? "▲" : "▼";
  const color = v > 0 ? GOOD : v < 0 ? BAD : INK_2;
  return (
    <span style={{ color }} className="whitespace-nowrap tabular-nums">
      <span aria-hidden className="mr-0.5 text-[0.7em]">
        {arrow}
      </span>
      {formatChange(d, ind)}
      <span className="sr-only">{v > 0 ? " (better)" : v < 0 ? " (worse)" : ""}</span>
    </span>
  );
}

export function EconomyDashboard({
  data,
  map,
  initial,
}: {
  data: MacroData;
  map: MapData;
  initial: { indicator: string; year: number; country: string | null };
}) {
  const { years, series } = data;
  const firstProjectionYear = Number(data.source.match(/(\d{4})/)?.[1] ?? years[years.length - 1]);
  const [indCode, setIndCode] = useState(initial.indicator);
  const [year, setYear] = useState(initial.year);
  const [mode, setMode] = useState<Mode>("level");
  const [selected, setSelected] = useState<string | null>(initial.country);
  const [focus, setFocus] = useState<{ code: string; nonce: number } | null>(null);
  const [hover, setHover] = useState<{ code: string; name: string; x: number; y: number } | null>(null);
  const [region, setRegion] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>({ col: "NGDPD", dir: -1 });
  const [playing, setPlaying] = useState(false);
  const mapBox = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const ind = INDICATORS.find((i) => i.code === indCode) ?? INDICATORS[0];
  const yi = years.indexOf(year);
  const val = (code: string, entity: string, idx = yi) => series[code]?.[entity]?.[idx] ?? null;
  const countryByCode = useMemo(() => new Map(data.countries.map((c) => [c.code, c])), [data.countries]);
  const regions = useMemo(() => ["All", ...[...new Set(data.countries.map((c) => c.region))].sort()], [data.countries]);

  // Keep the URL shareable without adding history entries.
  useEffect(() => {
    const p = new URLSearchParams();
    if (indCode !== INDICATORS[0].code) p.set("indicator", indCode);
    if (year !== initial.year) p.set("year", String(year));
    if (selected) p.set("country", selected);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [indCode, year, selected, initial.year]);

  // "Play" steps through the years on the map.
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

  const fill = (code: string) => {
    if (!code || !countryByCode.has(code)) return NO_DATA;
    return mode === "level" ? levelColor(val(ind.code, code), ind) : changeColor(val(ind.code, code), val(ind.code, code, yi - 1), ind);
  };

  // Rank among countries for the tooltip ("3rd of 190").
  const ranking = useMemo(() => {
    const vals = data.countries
      .map((c) => ({ code: c.code, v: series[ind.code]?.[c.code]?.[yi] ?? null }))
      .filter((r): r is { code: string; v: number } => r.v != null)
      .sort((a, b) => b.v - a.v);
    return { pos: new Map(vals.map((r, i) => [r.code, i + 1])), total: vals.length };
  }, [data.countries, series, ind.code, yi]);

  // Biggest movers vs the prior year, among economies over $20B so tiny
  // states' swings don't crowd out the big picture.
  const movers = useMemo(() => {
    const rows = data.countries
      .filter((c) => (series.NGDPD?.[c.code]?.[yi] ?? 0) >= 20)
      .map((c) => {
        const cur = series[ind.code]?.[c.code]?.[yi] ?? null;
        const prev = series[ind.code]?.[c.code]?.[yi - 1] ?? null;
        const d = change(cur, prev, ind);
        const v = verdict(cur, prev, ind);
        const t = ind.target ?? 0;
        const score = d == null ? null : ind.polarity === "target" ? Math.abs(prev! - t) - Math.abs(cur! - t) : ind.polarity === "up-bad" ? -d : d;
        return { c, cur, prev, score, v };
      })
      .filter((r) => r.score != null);
    const sorted = [...rows].sort((a, b) => b.score! - a.score!);
    return { up: sorted.slice(0, 5), down: sorted.slice(-5).reverse() };
  }, [data.countries, series, ind, yi]);

  const tableRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data.countries.filter(
      (c) => (region === "All" || c.region === region) && (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q),
    );
    return rows.sort((a, b) => {
      if (sort.col === "name") return a.name.localeCompare(b.name) * sort.dir;
      const av = series[sort.col]?.[a.code]?.[yi];
      const bv = series[sort.col]?.[b.code]?.[yi];
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * sort.dir;
    });
  }, [data.countries, region, query, sort, series, yi]);

  function select(code: string | null, zoom = false) {
    setSelected(code);
    if (code && zoom) {
      setFocus({ code, nonce: Date.now() });
      mapBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const yearLabel =
    year >= firstProjectionYear ? "IMF forecast" : year === firstProjectionYear - 1 ? "IMF estimate" : "Reported";
  const sel = selected ? countryByCode.get(selected) : null;
  const world = (code: string) => series[code]?.WEOWORLD;
  const tooltipEntity = hover && countryByCode.get(hover.code);

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
      {/* World at a glance */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {["NGDP_RPCH", "PCPIPCH", "GGXWDG_NGDP", "NGDPD"].map((code) => {
          const i = INDICATORS.find((x) => x.code === code)!;
          const cur = val(code, "WEOWORLD");
          const prev = val(code, "WEOWORLD", yi - 1);
          return (
            <button
              key={code}
              type="button"
              onClick={() => setIndCode(code)}
              className={`rounded-lg border bg-white p-4 text-left transition hover:border-zinc-400 ${
                indCode === code ? "border-zinc-900" : "border-zinc-200"
              }`}
            >
              <div className="text-xs text-zinc-500">World · {i.short}, {year}</div>
              <div className="mt-1 text-2xl font-semibold">{formatValue(cur, i)}</div>
              <div className="mt-1 text-xs">
                <Delta cur={cur} prev={prev} ind={i} /> <span className="text-zinc-500">vs {year - 1}</span>
              </div>
            </button>
          );
        })}
      </section>

      {/* Controls + map */}
      <section ref={mapBox} className="scroll-mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Indicator">
          {INDICATORS.map((i) => (
            <button
              key={i.code}
              type="button"
              role="tab"
              aria-selected={i.code === indCode}
              onClick={() => setIndCode(i.code)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                i.code === indCode ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
              }`}
            >
              {i.short}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
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
                  {y >= firstProjectionYear ? " (forecast)" : ""}
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
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              year >= firstProjectionYear ? "bg-amber-100 text-amber-900" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {yearLabel}
          </span>
          <div className="ml-auto flex overflow-hidden rounded-md border border-zinc-300 text-sm">
            {(["level", "change"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1 ${mode === m ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100"}`}
              >
                {m === "level" ? "Level" : `Change vs ${year - 1}`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium">
            {ind.label}, {year} <span className="text-sm font-normal text-zinc-500">({ind.unit})</span>
          </h2>
          <p className="text-sm text-zinc-600">{ind.legendNote}</p>
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
              className="pointer-events-none fixed z-50 min-w-44 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-lg"
              style={{ left: hover.x + 14, top: hover.y + 14 }}
            >
              <div className="font-medium">{tooltipEntity?.name ?? hover.name}</div>
              {tooltipEntity ? (
                <>
                  <div className="tabular-nums">
                    {ind.short}: <span className="font-semibold">{formatValue(val(ind.code, hover.code), ind)}</span>
                  </div>
                  <div className="text-xs">
                    <Delta cur={val(ind.code, hover.code)} prev={val(ind.code, hover.code, yi - 1)} ind={ind} />{" "}
                    <span className="text-zinc-500">vs {year - 1}</span>
                  </div>
                  {ranking.pos.get(hover.code) && (
                    <div className="text-xs text-zinc-500">
                      #{ranking.pos.get(hover.code)} of {ranking.total} (highest first)
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-zinc-500">No IMF data</div>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
          {legend
            ? legend.map((l) => (
                <span key={l.label} className="flex items-center gap-1 tabular-nums">
                  <span className="inline-block h-3 w-5 rounded-sm" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))
            : (
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
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold">
                {sel.name} <span className="text-sm font-normal text-zinc-500">{sel.region}</span>
              </h2>
              <div className="flex gap-2 text-sm">
                <button type="button" onClick={() => select(sel.code, true)} className="text-zinc-600 underline hover:text-zinc-900">
                  Zoom map here
                </button>
                <button type="button" onClick={() => setSelected(null)} className="text-zinc-600 underline hover:text-zinc-900">
                  Close
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {INDICATORS.map((i) => {
                const cur = val(i.code, sel.code);
                const prev = val(i.code, sel.code, yi - 1);
                return (
                  <div key={i.code} className="flex flex-col gap-1">
                    <div className="text-xs text-zinc-500">{i.label}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold tabular-nums">{formatValue(cur, i)}</span>
                      <span className="text-xs">
                        <Delta cur={cur} prev={prev} ind={i} />
                      </span>
                    </div>
                    <TrendChart
                      ind={i}
                      years={years}
                      values={series[i.code]?.[sel.code] ?? years.map(() => null)}
                      world={world(i.code)}
                      selectedYear={year}
                      firstProjectionYear={firstProjectionYear}
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Blue line: {sel.name}; dotted gray: world. Shaded area and dashed line are IMF forecasts. Values for {year}; change vs {year - 1}.
            </p>
          </section>
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
            Click a country on the map or in the table to see its full picture and trends since {years[0]}.
          </p>
        )}
      </div>

      {/* Movers */}
      <section className="grid gap-4 md:grid-cols-2">
        {[
          { title: ind.polarity === "neutral" ? "Biggest rises" : "Most improved", rows: movers.up },
          { title: ind.polarity === "neutral" ? "Biggest falls" : "Most deteriorated", rows: movers.down },
        ].map((box) => (
          <div key={box.title} className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-medium">
              {box.title}: {ind.short}, {year - 1}→{year}
            </h3>
            <p className="text-xs text-zinc-500">Economies over $20B</p>
            <ol className="mt-2 flex flex-col gap-1 text-sm">
              {box.rows.map((r) => (
                <li key={r.c.code} className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => select(r.c.code, true)} className="truncate text-left hover:underline">
                    {r.c.name}
                  </button>
                  <span className="flex gap-3 tabular-nums">
                    <span className="text-zinc-500">
                      {formatValue(r.prev, ind)} → {formatValue(r.cur, ind)}
                    </span>
                    <Delta cur={r.cur} prev={r.prev} ind={ind} />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      {/* Aggregates */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Regions and groups, {year}</h2>
        <p className="text-sm text-zinc-600">
          IMF totals for the world and major groupings. Green ▲/▼ = better than {year - 1}, red = worse.
        </p>
        <DataTable
          rows={data.aggregates.map((code) => ({
            code,
            name: AGGREGATES.find((a) => a.code === code)?.label ?? code,
          }))}
          series={series}
          yi={yi}
          highlight={indCode}
          scroll={false}
        />
      </section>

      {/* All countries */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">All countries, {year}</h2>
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
          <span className="self-center text-xs text-zinc-500">
            {tableRows.length} countries · click a column to sort, a row to open it
          </span>
        </div>
        <DataTable
          rows={tableRows}
          series={series}
          yi={yi}
          highlight={indCode}
          sort={sort}
          onSort={(col) => setSort((s) => (s.col === col ? { col, dir: (s.dir * -1) as 1 | -1 } : { col, dir: col === "name" ? 1 : -1 }))}
          onRow={(code) => select(code, true)}
          selected={selected}
        />
      </section>
    </div>
  );
}

function DataTable({
  rows,
  series,
  yi,
  highlight,
  sort,
  onSort,
  onRow,
  selected,
  scroll = true,
}: {
  rows: { code: string; name: string; region?: string }[];
  series: MacroData["series"];
  yi: number;
  highlight: string;
  sort?: SortKey;
  onSort?: (col: string) => void;
  onRow?: (code: string) => void;
  selected?: string | null;
  scroll?: boolean;
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
            {INDICATORS.map((i) => header(i.code, i.short))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.code}
              onClick={onRow ? () => onRow(r.code) : undefined}
              className={`border-t border-zinc-100 ${onRow ? "cursor-pointer hover:bg-zinc-50" : ""} ${
                selected === r.code ? "bg-blue-50" : ""
              }`}
            >
              <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-left font-medium">
                {r.name}
              </th>
              {INDICATORS.map((i) => {
                const cur = series[i.code]?.[r.code]?.[yi] ?? null;
                const prev = series[i.code]?.[r.code]?.[yi - 1] ?? null;
                return (
                  <td key={i.code} className={`px-2 py-1.5 text-right align-top ${i.code === highlight ? "bg-zinc-50" : ""}`}>
                    <div className="tabular-nums">{formatValue(cur, i)}</div>
                    <div className="text-[11px]">
                      <Delta cur={cur} prev={prev} ind={i} />
                    </div>
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
