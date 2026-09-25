"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MapData } from "@/lib/macro";

type View = { k: number; x: number; y: number };

const MIN_K = 1;
const MAX_K = 16;

// A choropleth world map with wheel / pinch / button zoom and drag to pan.
// Geometry is pre-projected (scripts/fetch-macro.ts), so this only moves a
// transform around; stroke widths stay constant at every zoom level.
export function WorldMap({
  map,
  fill,
  selected,
  focusCode,
  onHover,
  onSelect,
}: {
  map: MapData;
  fill: (code: string) => string;
  selected: string | null;
  // Changing this zooms the map onto that country (used by table clicks).
  focusCode: { code: string; nonce: number } | null;
  onHover: (code: string | null, name: string, clientX: number, clientY: number) => void;
  onSelect: (code: string | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; pinchDist: number | null; code: string | null }>({
    moved: 0,
    pinchDist: null,
    code: null,
  });

  const { width, height } = map;

  const clamp = useCallback(
    (v: View): View => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k));
      const x = Math.min(0, Math.max(width * (1 - k), v.x));
      const y = Math.min(0, Math.max(height * (1 - k), v.y));
      return { k, x, y };
    },
    [width, height],
  );

  // Client (screen) coordinates -> SVG viewBox coordinates.
  const toSvg = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current!.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * width,
        y: ((clientY - rect.top) / rect.height) * height,
      };
    },
    [width, height],
  );

  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      setView((v) => {
        const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
        const f = k / v.k;
        return clamp({ k, x: px - (px - v.x) * f, y: py - (py - v.y) * f });
      });
    },
    [clamp],
  );

  // Wheel needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toSvg, zoomAt]);

  // Zoom onto a country picked from the table.
  useEffect(() => {
    if (!focusCode) return;
    const el = pathRefs.current.get(focusCode.code);
    if (!el) return;
    const b = el.getBBox();
    const pad = 1.6;
    const k = Math.min(8, Math.max(1.5, Math.min(width / (b.width * pad), height / (b.height * pad))));
    setView(clamp({ k, x: width / 2 - (b.x + b.width / 2) * k, y: height / 2 - (b.y + b.height / 2) * k }));
  }, [focusCode, clamp, width, height]);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // Read the country before capturing: once captured, events target the svg.
    const code = (e.target as Element).getAttribute?.("data-code") || null;
    svgRef.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = { moved: 0, pinchDist: null, code };
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) {
      // Plain hover (no button down).
      const code = (e.target as Element).getAttribute?.("data-code");
      const name = (e.target as Element).getAttribute?.("data-name") ?? "";
      onHover(code || null, name, e.clientX, e.clientY);
      return;
    }
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = width / rect.width;
    if (pointers.current.size === 1) {
      const dx = (e.clientX - prev.x) * scale;
      const dy = (e.clientY - prev.y) * scale;
      gesture.current.moved += Math.abs(dx) + Math.abs(dy);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (gesture.current.moved > 3) onHover(null, "", 0, 0);
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (pointers.current.size === 2) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (gesture.current.pinchDist) zoomAt(dist / gesture.current.pinchDist, mid.x, mid.y);
      gesture.current.pinchDist = dist;
      gesture.current.moved += 10;
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const wasTap = pointers.current.size === 1 && gesture.current.moved <= 3;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current.pinchDist = null;
    if (wasTap) onSelect(gesture.current.code);
  }

  const zoomButton = (factor: number) => zoomAt(factor, width / 2, height / 2);
  const selectedShape = selected ? map.shapes.filter((s) => s.code === selected) : [];

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full cursor-grab touch-none select-none rounded-lg border border-zinc-200 bg-[#f2f6fb] active:cursor-grabbing"
        role="img"
        aria-label="World map; the country table below has the same data"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => onHover(null, "", 0, 0)}
        onDoubleClick={(e) => {
          const p = toSvg(e.clientX, e.clientY);
          zoomAt(2, p.x, p.y);
        }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {map.shapes.map((s, i) => (
            <path
              key={`${s.code}-${i}`}
              ref={(el) => {
                if (el && s.code && !pathRefs.current.has(s.code)) pathRefs.current.set(s.code, el);
              }}
              d={s.d}
              data-code={s.code}
              data-name={s.name}
              fill={fill(s.code)}
              stroke="#ffffff"
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
              className="transition-[fill] duration-300 hover:opacity-80"
            />
          ))}
          {selectedShape.map((s, i) => (
            <path
              key={`sel-${i}`}
              d={s.d}
              fill="none"
              stroke="#0b0b0b"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}
        </g>
      </svg>
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-md border border-zinc-300 bg-white shadow-sm">
        <button type="button" aria-label="Zoom in" onClick={() => zoomButton(1.6)} className="h-8 w-8 text-lg leading-none hover:bg-zinc-100">
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomButton(1 / 1.6)} className="h-8 w-8 border-t border-zinc-200 text-lg leading-none hover:bg-zinc-100">
          −
        </button>
        <button type="button" aria-label="Reset zoom" onClick={() => setView({ k: 1, x: 0, y: 0 })} className="h-8 w-8 border-t border-zinc-200 text-xs hover:bg-zinc-100">
          ⤢
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Scroll or pinch to zoom, drag to move, click a country for its details.
        {view.k > 1 && <span> Zoom {view.k.toFixed(1)}×</span>}
      </p>
    </div>
  );
}
