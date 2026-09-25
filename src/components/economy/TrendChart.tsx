"use client";

import { useState } from "react";

const W = 280;
const H = 110;
const PAD = { l: 4, r: 4, t: 10, b: 18 };
const LINE = "#2a78d6";
const WORLD = "#898781";

// One indicator over time for one country: solid line for reported periods,
// dashed after `forecastFrom` (IMF projections), dotted gray for the world
// figure, a marker on the highlighted period, and a hover crosshair.
export function TrendChart({
  label,
  labels,
  values,
  world,
  highlight,
  forecastFrom,
  fmt,
  zeroBase,
}: {
  label: string;
  labels: string[];
  values: (number | null)[];
  world?: (number | null)[];
  highlight: number;
  forecastFrom: number | null;
  fmt: (v: number | null | undefined) => string;
  zeroBase: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const all = [...values, ...(world ?? [])].filter((v): v is number => v != null);
  if (values.every((v) => v == null) || labels.length < 2) {
    return <p className="py-8 text-center text-xs text-zinc-500">No data</p>;
  }
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (zeroBase) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (max === min) {
    max += 1;
    min -= 1;
  }
  const n = labels.length;
  const x = (i: number) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r);
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
  const split = forecastFrom == null ? n - 1 : Math.max(0, forecastFrom - 1);
  const hi = hover ?? highlight;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${label}, ${labels[0]} to ${labels[n - 1]}`}
      >
        {zeroBase && min < 0 && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="#c3c2b7" strokeWidth={1} />
        )}
        {forecastFrom != null && forecastFrom < n && (
          <>
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
          </>
        )}
        {world && <path d={line(world, 0, n - 1)} fill="none" stroke={WORLD} strokeWidth={1} strokeDasharray="1 2" />}
        <path d={line(values, 0, split)} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
        {split < n - 1 && (
          <path d={line(values, split, n - 1)} fill="none" stroke={LINE} strokeWidth={2} strokeDasharray="4 3" />
        )}
        {hi >= 0 && hi < n && values[hi] != null && (
          <>
            <line x1={x(hi)} x2={x(hi)} y1={PAD.t - 4} y2={H - PAD.b} stroke="#c3c2b7" strokeWidth={1} />
            <circle cx={x(hi)} cy={y(values[hi]!)} r={4} fill={LINE} stroke="#fff" strokeWidth={2} />
          </>
        )}
        <text x={PAD.l} y={H - 4} fontSize={9} fill="#898781">
          {labels[0]}
        </text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end" fontSize={9} fill="#898781">
          {labels[n - 1]}
        </text>
      </svg>
      {hi >= 0 && hi < n && (
        <div className="pointer-events-none absolute left-1 top-0 rounded bg-white/90 px-1 text-[11px] tabular-nums text-zinc-700">
          <span className="font-medium">{labels[hi]}</span>: {fmt(values[hi])}
          {world && world[hi] != null && <span className="text-zinc-500"> · world {fmt(world[hi])}</span>}
        </div>
      )}
    </div>
  );
}
