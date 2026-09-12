/**
 * Local-only CLI to publish/update a report directly in the database,
 * bypassing the /admin web form. Intended to be run by a Claude Code
 * session (or the developer) after drafting the analysis — never expose
 * this as a network endpoint; it does no auth because it assumes whoever
 * can run it on this machine is already trusted.
 *
 * Usage:
 *   npm run publish-report -- path/to/report.json
 *
 * JSON shape:
 * {
 *   "companySlug": "aapl",
 *   "year": 2026,
 *   "period": "Q3",            // one of Q1 Q2 Q3 Q4 H1 ANNUAL
 *   "title": "AAPL — Q3 2026 Financial Report Analysis",
 *   "summary": "One sentence shown in lists and search.",
 *   "contentMd": "## Overview\n...",
 *   "coverImageUrl": "https://... "   // optional
 * }
 *
 * Re-running with the same companySlug/year/period updates the existing
 * report instead of failing, so you can safely fix and re-publish.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient, ReportPeriod } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

const VALID_PERIODS = Object.values(ReportPeriod);

type ReportInput = {
  companySlug: string;
  year: number;
  period: ReportPeriod;
  title: string;
  summary: string;
  contentMd: string;
  coverImageUrl?: string | null;
};

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function loadInput(path: string): ReportInput {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    fail(`Could not read file: ${path}`);
  }

  let data: Partial<ReportInput>;
  try {
    data = JSON.parse(raw!);
  } catch (e) {
    fail(`Invalid JSON in ${path}: ${(e as Error).message}`);
  }

  const missing = (["companySlug", "year", "period", "title", "summary", "contentMd"] as const)
    .filter((key) => data[key] === undefined || data[key] === null || data[key] === "");
  if (missing.length > 0) {
    fail(`Missing required field(s): ${missing.join(", ")}`);
  }

  if (!VALID_PERIODS.includes(data.period as ReportPeriod)) {
    fail(`Invalid period "${data.period}". Must be one of: ${VALID_PERIODS.join(", ")}`);
  }

  if (typeof data.year !== "number" || Number.isNaN(data.year)) {
    fail(`"year" must be a number, got: ${JSON.stringify(data.year)}`);
  }

  return data as ReportInput;
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    fail("Usage: npm run publish-report -- path/to/report.json");
  }

  const input = loadInput(path!);

  const company = await prisma.company.findUnique({
    where: { slug: input.companySlug },
  });

  if (!company) {
    const all = await prisma.company.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    });
    console.error(`Error: no company with slug "${input.companySlug}".`);
    console.error(`Run "npm run list-companies" to see valid slugs, or add the company via /admin/companies first.`);
    console.error(`Closest known slugs: ${all.filter((c) => c.slug.includes(input.companySlug.slice(0, 3))).map((c) => c.slug).join(", ") || "(none obviously close)"}`);
    process.exit(1);
  }

  const report = await prisma.report.upsert({
    where: {
      companyId_year_period: {
        companyId: company!.id,
        year: input.year,
        period: input.period,
      },
    },
    create: {
      companyId: company!.id,
      year: input.year,
      period: input.period,
      title: input.title,
      summary: input.summary,
      contentMd: input.contentMd,
      coverImageUrl: input.coverImageUrl ?? null,
    },
    update: {
      title: input.title,
      summary: input.summary,
      contentMd: input.contentMd,
      coverImageUrl: input.coverImageUrl ?? null,
    },
  });

  console.log(`Published: ${report.title}`);
  console.log(`View:  http://localhost:3000/reports/${report.id}`);
  console.log(`Edit:  http://localhost:3000/admin/reports/${report.id}/edit`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
