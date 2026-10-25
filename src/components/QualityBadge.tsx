import { EARNINGS_QUALITY, type EarningsQuality } from "@/lib/metrics";

// The report's verdict on the reported figures, from Report.metrics. `compact`
// is the one-line form for cards; the full form adds the reason and what the
// label means, for a reader who has not met it before.
export function QualityBadge({
  quality,
  note,
  compact = false,
}: {
  quality: EarningsQuality;
  note?: string;
  compact?: boolean;
}) {
  const q = EARNINGS_QUALITY[quality];
  if (compact) {
    return (
      <span className={`inline-flex items-baseline gap-1 rounded-full border px-2 py-0.5 text-xs ${q.className}`}>
        <span className="font-semibold">{q.label}</span>
        {note && <span className="opacity-90">· {note}</span>}
      </span>
    );
  }
  return (
    <section aria-label="Earnings quality" className={`rounded-lg border px-5 py-4 ${q.className}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-semibold uppercase tracking-wide opacity-80">
          Earnings quality
        </span>
        <span className="text-lg font-semibold">{q.label}</span>
      </div>
      {note && <p className="mt-1 text-sm">{note}</p>}
      <p className="mt-2 text-xs opacity-80">{q.description}</p>
    </section>
  );
}
