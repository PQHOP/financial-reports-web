"use client";

import { useState } from "react";
import { formatValue, type Indicator } from "@/lib/macro";

const W = 280;
const H = 110;
const PAD = { l: 4, r: 4, t: 10, b: 18 };
const LINE = "#2a78d6";
const WORLD = "#898781";

// One indicator over time for one country: solid line for reported years,
// dashed for IMF projections, gray line for the world figure, a marker on the
// year selected above, and a hover crosshair with the exact value.
export function TrendChart({
  ind,
  years,
  values,
  world,
  selectedYear,
  firstProjectionYear,
}: {
  ind: Indicator;
  years: number[];
  values: (number | null)[];
  world: (number | null)[] | undefined;
  selectedYear: number;
  firstProjectionYear: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const all = [...values, ...(ind.format === "pct" ? (world ?? []) : [])].filter((v): v is number => v != null);
  if (values.every((v) => v == null)) {
    return <p className="py-8 text-center text-xs text-zinc-500">No IMF data</p>;
  }
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (ind.format === "pct") {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (max === min) max = min + 1;
  const x = (i: number) => PAD.l + (i / (years.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);

  const line = (series: (number | null)[], from: number, to: number) => {
    let d = "";
    let pen = false;
    for (let i = from; i <= to; i++) {
      const v = series[i];
      if (v == null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const split = years.indexOf(firstProjectionYear) - 1; // last reported index
  const selIdx = years.indexOf(selectedYear);
  const hi = hover ?? selIdx;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (years.length - 1));
          setHover(Math.max(0, Math.min(years.length - 1, i)));
        }}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${ind.label}, ${years[0]}–${years[years.length - 1]}`}
      >
        {ind.format === "pct" && min < 0 && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="#c3c2b7" strokeWidth={1} />
        )}
        <rect
          x={x(split)}
          y={PAD.t - 6}
          width={W - PAD.r - x(split)}
          height={H - PAD.t - PAD.b + 6}
          fill="#f4f3ef"
        />
        <text x={W - PAD.r} y={PAD.t - 1} textAnchor="end" fontSize={8} fill="#898781">
          IMF forecast
        </text>
        {world && ind.format === "pct" && (
          <path d={line(world, 0, years.length - 1)} fill="none" stroke={WORLD} strokeWidth={1} strokeDasharray="1 2" />
        )}
        <path d={line(values, 0, split)} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
        <path d={line(values, split, years.length - 1)} fill="none" stroke={LINE} strokeWidth={2} strokeDasharray="4 3" />
        {hi >= 0 && values[hi] != null && (
          <>
            <line x1={x(hi)} x2={x(hi)} y1={PAD.t - 4} y2={H - PAD.b} stroke="#c3c2b7" strokeWidth={1} />
            <circle cx={x(hi)} cy={y(values[hi]!)} r={4} fill={LINE} stroke="#fff" strokeWidth={2} />
          </>
        )}
        <text x={PAD.l} y={H - 4} fontSize={9} fill="#898781">
          {years[0]}
        </text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end" fontSize={9} fill="#898781">
          {years[years.length - 1]}
        </text>
      </svg>
      {hi >= 0 && (
        <div className="pointer-events-none absolute left-1 top-0 rounded bg-white/90 px-1 text-[11px] tabular-nums text-zinc-700">
          <span className="font-medium">{years[hi]}</span>: {formatValue(values[hi], ind)}
          {world && world[hi] != null && ind.format === "pct" && (
            <span className="text-zinc-500"> · world {formatValue(world[hi], ind)}</span>
          )}
        </div>
      )}
    </div>
  );
}
