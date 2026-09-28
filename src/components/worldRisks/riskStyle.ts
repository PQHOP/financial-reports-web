import type { RiskEvent, RiskLayer, RiskLevel } from "@/lib/worldRisks";

// Alert levels are status, so they take the fixed status steps (always shown
// with a text label); "minor" and "normal" recede to neutral gray.
export const LEVEL_COLOR: Record<RiskLevel, string> = {
  red: "#d03b3b",
  orange: "#ec835a",
  yellow: "#fab219",
  green: "#a3a29b",
  down: "#d03b3b",
  low: "#ec835a",
  normal: "#a3a29b",
  up: "#2a78d6",
};

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  red: "Red alert",
  orange: "Orange alert",
  yellow: "Yellow alert",
  green: "Green alert",
  down: "Traffic down 25%+",
  low: "Traffic down 10–25%",
  normal: "Traffic near normal",
  up: "Traffic up 10%+",
};

export const LAYER_INFO: Record<RiskLayer, { label: string; shape: "circle" | "diamond" | "square" | "triangle"; color: string }> = {
  disaster: { label: "Disasters", shape: "circle", color: "#d03b3b" },
  quake: { label: "Earthquakes", shape: "diamond", color: "#d03b3b" },
  outbreak: { label: "Outbreaks", shape: "square", color: "#4a3aa7" },
  chokepoint: { label: "Shipping chokepoints", shape: "triangle", color: "#2a78d6" },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function formatEventDate(e: RiskEvent): string {
  if (e.layer === "quake") {
    return `${new Date(e.start).toUTCString().slice(5, 22)} UTC`;
  }
  if (e.layer === "outbreak") return `WHO notice ${fmt(e.start)}`;
  if (e.end && e.end.slice(0, 10) !== e.start.slice(0, 10)) return `${fmt(e.start)} – ${fmt(e.end)}`;
  return fmt(e.start);
}
