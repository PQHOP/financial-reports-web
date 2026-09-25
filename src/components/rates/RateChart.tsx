"use client";

import { TrendChart } from "@/components/economy/TrendChart";

// TrendChart takes a formatter function, which a server page can't pass to a
// client component; this wrapper takes the decimals instead.
export function RateChart({
  label,
  labels,
  values,
  decimals = 2,
  height = 160,
}: {
  label: string;
  labels: string[];
  values: number[];
  decimals?: number;
  height?: number;
}) {
  return (
    <TrendChart
      label={label}
      labels={labels}
      values={values}
      highlight={values.length - 1}
      forecastFrom={null}
      fmt={(v) => (v == null ? "–" : `${v.toFixed(decimals)}%`)}
      zeroBase={false}
      height={height}
    />
  );
}
