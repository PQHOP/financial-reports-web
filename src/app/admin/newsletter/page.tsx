import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getIsAdmin } from "@/lib/adminAuth";
import { periodLabels } from "@/lib/period";
import { metricsHeadline, readMetrics } from "@/lib/metrics";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Weekly digest draft: everything published in the last 7 days as Markdown,
// ready to paste into a newsletter tool (Beehiiv, Substack, ...) and edit.
export default async function NewsletterDraftPage() {
  if (!(await getIsAdmin())) {
    redirect("/admin/login");
  }

  const since = daysAgo(7);
  const [reports, articles] = await Promise.all([
    prisma.report.findMany({
      where: { publishedAt: { gte: since } },
      orderBy: { publishedAt: "desc" },
      include: { company: { select: { name: true, ticker: true } } },
    }),
    prisma.article.findMany({
      where: { publishedAt: { gte: since } },
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  const lines: string[] = [
    `# ${SITE_NAME}: this week's earnings analyses`,
    "",
    `${reports.length} new ${reports.length === 1 ? "analysis" : "analyses"} in the last 7 days.`,
    "",
  ];
  for (const report of reports) {
    const metrics = readMetrics(report.metrics);
    const headline = metrics ? metricsHeadline(metrics) : "";
    const label = report.company.ticker ?? report.company.name;
    lines.push(
      `## ${label}: ${periodLabels[report.period]} ${report.year}`,
      ...(headline ? [`**${headline}**`, ""] : []),
      report.summary,
      "",
      `[Read the full analysis](${SITE_URL}/reports/${report.id})`,
      ""
    );
  }
  if (articles.length > 0) {
    lines.push("## Also new", "");
    for (const article of articles) {
      const path = article.kind === "GUIDE" ? "learn" : "insights";
      lines.push(`- [${article.title}](${SITE_URL}/${path}/${article.slug})`);
    }
    lines.push("");
  }
  lines.push(
    "---",
    "",
    "Analyses are for information only and are not investment advice."
  );
  const draft = lines.join("\n");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Newsletter draft</h1>
        <p className="text-sm text-zinc-500">
          Generated from the last 7 days of publications. Copy, edit, send.
        </p>
      </div>
      <textarea
        readOnly
        value={draft}
        rows={28}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm"
      />
    </div>
  );
}
