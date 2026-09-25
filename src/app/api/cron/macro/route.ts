import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INDICATORS, type MacroData } from "@/lib/macro";
import { fetchLive, type LiveData } from "@/lib/macroLive";
import { fetchWeoSeries } from "@/lib/macroWeo";
import { loadMacro } from "@/lib/macroStore";

export const dynamic = "force-dynamic";
// Several public statistics APIs, some slow (IMF quarterly accounts).
export const maxDuration = 300;

// Daily refresh of the /economy data (see vercel.json). Calls public APIs
// only, no model, so it costs nothing and doesn't touch the Claude budget.
// A source that fails keeps its previous values (fetchLive), and a failed
// WEO fetch keeps the stored annual values.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { weo, live: previous } = await loadMacro();
  const keep = new Set([...weo.countries.map((c) => c.code), ...weo.aggregates]);

  const [liveRes, weoRes] = await Promise.allSettled([
    fetchLive(weo.countries, previous),
    fetchWeoSeries(keep),
  ]);

  const summary: Record<string, unknown> = {};
  if (liveRes.status === "fulfilled") {
    const live: LiveData = liveRes.value;
    await prisma.macroSnapshot.upsert({
      where: { id: "live" },
      create: { id: "live", data: live },
      update: { data: live },
    });
    summary.live = live.sources;
  } else {
    summary.live = { error: String(liveRes.reason).slice(0, 300) };
  }

  // Only store a WEO fetch that looks complete (every indicator present).
  if (weoRes.status === "fulfilled" && INDICATORS.every((i) => Object.keys(weoRes.value.series[i.code] ?? {}).length > 50)) {
    const data: Pick<MacroData, "source" | "fetchedAt" | "series"> = {
      source: weoRes.value.source,
      fetchedAt: new Date().toISOString().slice(0, 10),
      series: weoRes.value.series,
    };
    await prisma.macroSnapshot.upsert({
      where: { id: "weo" },
      create: { id: "weo", data },
      update: { data },
    });
    summary.weo = { ok: true, source: data.source };
  } else {
    summary.weo = { ok: false, error: weoRes.status === "rejected" ? String(weoRes.reason).slice(0, 300) : "incomplete" };
  }

  return NextResponse.json(summary);
}
