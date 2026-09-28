import Link from "next/link";
import type { ResolvedImpact } from "@/lib/riskImpacts";

// Shared by the /world-risks list (server) and the map's detail panel (client).
export function ImpactBody({ impact }: { impact: ResolvedImpact }) {
  return (
    <>
      {impact.why && <p className="mt-1 text-sm text-zinc-700">{impact.why}</p>}
      <dl className="mt-2 flex flex-col gap-1 text-sm">
        {impact.groups.map((g) => (
          <div key={g.role} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <dt className="text-xs text-zinc-500">{g.role}:</dt>
            <dd className="flex flex-wrap gap-1.5">
              {g.companies.map((c) => (
                <Link
                  key={c.ticker}
                  href={c.href}
                  className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-blue-700 hover:border-zinc-400"
                >
                  {c.ticker}
                </Link>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
