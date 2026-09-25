import { prisma } from "@/lib/prisma";
import type { MacroData } from "@/lib/macro";
import type { LiveData } from "@/lib/macroLive";
import bundledWeo from "@/data/macro.json";
import bundledLive from "@/data/macro-live.json";

// /economy reads the daily snapshots written by /api/cron/macro and falls
// back to the copies bundled at build time (npm run fetch-macro) when the
// database has none yet or can't be reached.
export async function loadMacro(): Promise<{ weo: MacroData; live: LiveData }> {
  const weoFallback = bundledWeo as MacroData;
  const liveFallback = bundledLive as unknown as LiveData;
  try {
    const rows = await prisma.macroSnapshot.findMany({ where: { id: { in: ["weo", "live"] } } });
    const byId = new Map(rows.map((r) => [r.id, r.data]));
    const weoSeries = byId.get("weo") as { source: string; fetchedAt: string; series: MacroData["series"] } | undefined;
    const live = byId.get("live") as LiveData | undefined;
    return {
      // The country list, years and aggregates stay with the build; only the
      // values and edition label come from the database.
      weo: weoSeries?.series ? { ...weoFallback, ...weoSeries } : weoFallback,
      live: live?.updatedAt && live.updatedAt > liveFallback.updatedAt ? live : liveFallback,
    };
  } catch {
    return { weo: weoFallback, live: liveFallback };
  }
}
