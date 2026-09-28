"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WorldMap } from "@/components/economy/WorldMap";
import type { MapData } from "@/lib/macro";
import type { RiskEvent, RiskLayer, RiskLevel } from "@/lib/worldRisks";
import type { ResolvedImpact } from "@/lib/riskImpacts";
import { ImpactBody } from "@/components/worldRisks/ImpactBody";
import { LAYER_INFO, LEVEL_COLOR, LEVEL_LABEL, formatEventDate } from "@/components/worldRisks/riskStyle";

const LAND = "#e4e3de";
const PREFIX = "ev:";

// `unit`: map units per screen pixel, so markers keep the same on-screen size
// on a phone and a wide monitor, and at every zoom level.
function Marker({ e, k, unit }: { e: RiskEvent; k: number; unit: number }) {
  const big = e.level === "red" || e.level === "down";
  const mid = e.level === "orange" || e.level === "low" || e.level === "yellow";
  const r = ((big ? 6.5 : mid ? 5 : 3.8) * unit) / k;
  const fill = e.layer === "outbreak" ? LAYER_INFO.outbreak.color : LEVEL_COLOR[e.level ?? "normal"];
  // Events that are over stay on the map as outlines.
  const hollow = !e.current;
  const common = {
    "data-code": `${PREFIX}${e.id}`,
    "data-name": e.title,
    fill: hollow ? "#ffffff" : fill,
    stroke: hollow ? fill : "#ffffff",
    strokeWidth: hollow ? 2 : 1.5,
    vectorEffect: "non-scaling-stroke" as const,
    className: "cursor-pointer",
  };
  const x = e.x!;
  const y = e.y!;
  switch (LAYER_INFO[e.layer].shape) {
    case "diamond":
      return <path d={`M${x} ${y - r * 1.3}L${x + r * 1.3} ${y}L${x} ${y + r * 1.3}L${x - r * 1.3} ${y}Z`} {...common} />;
    case "square":
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={r * 0.25} {...common} />;
    case "triangle":
      return <path d={`M${x} ${y - r * 1.35}L${x + r * 1.25} ${y + r * 0.9}L${x - r * 1.25} ${y + r * 0.9}Z`} {...common} />;
    default:
      return <circle cx={x} cy={y} r={r} {...common} />;
  }
}

export function RiskMap({
  map,
  events,
  impacts,
}: {
  map: MapData;
  events: RiskEvent[];
  impacts: Record<string, ResolvedImpact>;
}) {
  const [layers, setLayers] = useState<Record<RiskLayer, boolean>>({
    disaster: true,
    quake: true,
    outbreak: true,
    chokepoint: true,
  });
  const [minor, setMinor] = useState(false);
  const [hover, setHover] = useState<{ e: RiskEvent | null; name: string; x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Map units per CSS pixel (the map's viewBox is map.width units wide).
  const boxRef = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(1);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setUnit(map.width / Math.max(el.clientWidth, 1));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [map.width]);

  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const isMinor = (e: RiskEvent) =>
    (e.layer === "disaster" || e.layer === "quake") && (e.level === "green" || e.level === null);
  const shown = (e: RiskEvent) => minor || !isMinor(e) || e.layer === "quake";
  const visible = events
    .filter((e) => e.x !== null && layers[e.layer] && shown(e))
    // Draw the most severe last so it sits on top.
    .sort((a, b) => severity(b) - severity(a));
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const counts = Object.fromEntries(
    (Object.keys(LAYER_INFO) as RiskLayer[]).map((l) => [l, events.filter((e) => e.layer === l && shown(e)).length])
  ) as Record<RiskLayer, number>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(Object.keys(LAYER_INFO) as RiskLayer[]).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={layers[l]}
            onClick={() => setLayers((s) => ({ ...s, [l]: !s[l] }))}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${
              layers[l] ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-600"
            }`}
          >
            <ShapeIcon layer={l} />
            {LAYER_INFO[l].label} ({counts[l]})
          </button>
        ))}
        <label className="ml-1 flex items-center gap-1.5 text-xs text-zinc-600">
          <input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} />
          Include minor (green) disaster alerts
        </label>
      </div>

      <div ref={boxRef} className="relative" onMouseLeave={() => setHover(null)}>
        <WorldMap
          map={map}
          fill={() => LAND}
          selected={null}
          focusCode={null}
          hint="hover or tap a marker for details"
          onHover={(code, name, x, y) => {
            if (!code) return setHover(null);
            const e = code.startsWith(PREFIX) ? byId.get(code.slice(PREFIX.length)) ?? null : null;
            setHover({ e, name, x, y });
          }}
          onSelect={(code) => setSelectedId(code?.startsWith(PREFIX) ? code.slice(PREFIX.length) : null)}
          overlay={(k) => visible.map((e) => <Marker key={e.id} e={e} k={k} unit={unit} />)}
        />
        {hover && (
          <div
            className="pointer-events-none fixed z-50 max-w-xs rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: hover.x + 14, top: hover.y + 14 }}
          >
            {hover.e ? <EventSummary e={hover.e} /> : <span className="font-medium">{hover.name}</span>}
          </div>
        )}
      </div>

      <Legend />

      {selected && (
        <div className="rounded-lg border border-zinc-300 bg-white p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <EventSummary e={selected} />
            <button type="button" onClick={() => setSelectedId(null)} className="text-zinc-500 hover:text-zinc-900" aria-label="Close">
              ✕
            </button>
          </div>
          {impacts[selected.id] && (
            <div className="mt-3 border-t border-zinc-100 pt-2">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Why markets care</div>
              <ImpactBody impact={impacts[selected.id]} />
            </div>
          )}
          <a href={selected.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-blue-700 underline">
            Source details
          </a>
        </div>
      )}
    </div>
  );
}

function severity(e: RiskEvent): number {
  return ({ red: 4, down: 4, orange: 3, low: 3, yellow: 2 } as Partial<Record<RiskLevel, number>>)[e.level ?? "normal"] ?? 1;
}

function EventSummary({ e }: { e: RiskEvent }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-zinc-500">
        {e.kind}
        {e.level && ` · ${LEVEL_LABEL[e.level]}`}
        {!e.current && " · ended"}
      </span>
      <span className="font-medium text-zinc-900">{e.title}</span>
      {e.place && e.place !== e.title && <span className="text-zinc-700">{e.place}</span>}
      {e.detail && <span className="text-zinc-600">{e.detail}</span>}
      <span className="text-zinc-500">{formatEventDate(e)}</span>
    </div>
  );
}

function ShapeIcon({ layer, color = "currentColor" }: { layer: RiskLayer; color?: string }) {
  const shape = LAYER_INFO[layer].shape;
  return (
    <svg viewBox="-6 -6 12 12" className="h-3 w-3" aria-hidden>
      {shape === "diamond" ? (
        <path d="M0 -5.5L5.5 0L0 5.5L-5.5 0Z" fill={color} />
      ) : shape === "square" ? (
        <rect x={-4.5} y={-4.5} width={9} height={9} rx={1} fill={color} />
      ) : shape === "triangle" ? (
        <path d="M0 -5.5L5.2 4.5L-5.2 4.5Z" fill={color} />
      ) : (
        <circle r={5} fill={color} />
      )}
    </svg>
  );
}

function Legend() {
  const swatch = (color: string, label: string, hollow = false) => (
    <li className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={hollow ? { border: `2px solid ${color}` } : { background: color }}
      />
      {label}
    </li>
  );
  return (
    <div className="flex flex-col gap-1.5 text-xs text-zinc-600">
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        <li className="font-medium text-zinc-700">Disasters &amp; earthquakes:</li>
        {swatch(LEVEL_COLOR.red, "Red alert (severe)")}
        {swatch(LEVEL_COLOR.orange, "Orange alert")}
        {swatch(LEVEL_COLOR.yellow, "Yellow alert")}
        {swatch(LEVEL_COLOR.green, "Minor / no alert")}
        {swatch(LEVEL_COLOR.red, "Outline = ended in last 30 days", true)}
      </ul>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        <li className="font-medium text-zinc-700">Chokepoints (ships vs a year ago):</li>
        {swatch(LEVEL_COLOR.down, "Down 25%+")}
        {swatch(LEVEL_COLOR.low, "Down 10–25%")}
        {swatch(LEVEL_COLOR.normal, "Within ±10%")}
        {swatch(LEVEL_COLOR.up, "Up 10%+")}
      </ul>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        <li className="font-medium text-zinc-700">Shapes:</li>
        {(Object.keys(LAYER_INFO) as RiskLayer[]).map((l) => (
          <li key={l} className="flex items-center gap-1.5">
            <ShapeIcon layer={l} color={l === "outbreak" ? LAYER_INFO.outbreak.color : "#52514e"} />
            {LAYER_INFO[l].label}
          </li>
        ))}
      </ul>
    </div>
  );
}
