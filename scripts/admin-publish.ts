/**
 * Drives the real /admin UI with a headless browser to publish a report —
 * logs in and fills out the actual form, the same way a human admin would.
 * Works against localhost during development and against a deployed site
 * once one exists, by pointing SITE_URL at it. No direct database access
 * needed at all.
 *
 * Usage:
 *   npm run admin-publish -- --list                        # see valid company names
 *   npm run admin-publish -- path/to/report.json            # publish a new report
 *   npm run admin-publish -- --edit <reportId> report.json  # update an existing report
 *
 * Env vars:
 *   SITE_URL        Defaults to http://localhost:3000
 *   ADMIN_PASSWORD  Defaults to the value in .env (same one the site uses)
 *
 * JSON shape:
 * {
 *   "company": "Apple",        // substring match against the company
 *                               // dropdown's visible text (name or ticker)
 *   "year": 2026,
 *   "period": "Q3",             // Q1 Q2 Q3 Q4 H1 ANNUAL
 *   "title": "AAPL — Q3 2026 Financial Report Analysis",
 *   "summary": "One sentence shown in report lists and search.",
 *   "contentMd": "## Overview\n...",
 *   "coverImageUrl": "https://..."   // optional
 * }
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

type ReportInput = {
  company: string;
  year: number;
  period: string;
  title: string;
  summary: string;
  contentMd: string;
  coverImageUrl?: string;
};

const VALID_PERIODS = ["Q1", "Q2", "Q3", "Q4", "H1", "ANNUAL"];

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

  const missing = (["company", "year", "period", "title", "summary", "contentMd"] as const)
    .filter((key) => data[key] === undefined || data[key] === null || data[key] === "");
  if (missing.length > 0) fail(`Missing required field(s): ${missing.join(", ")}`);
  if (!VALID_PERIODS.includes(data.period as string)) {
    fail(`Invalid period "${data.period}". Must be one of: ${VALID_PERIODS.join(", ")}`);
  }

  return data as ReportInput;
}

async function login(page: Page) {
  if (!ADMIN_PASSWORD) {
    fail("ADMIN_PASSWORD is not set (check .env, or set it in the environment for a deployed site).");
  }

  await page.goto(`${SITE_URL}/admin/login`);
  await page.fill('input[name="password"]', ADMIN_PASSWORD!);
  await Promise.all([
    page.waitForURL(`${SITE_URL}/admin`, { timeout: 10_000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  if (!page.url().startsWith(`${SITE_URL}/admin`) || page.url().includes("/admin/login")) {
    fail("Login failed — check ADMIN_PASSWORD.");
  }
}

async function listCompanies(page: Page) {
  await page.goto(`${SITE_URL}/admin/reports/new`);
  const options = await page
    .locator('select[name="companyId"] option')
    .evaluateAll((els) =>
      els.map((el) => (el as HTMLOptionElement).textContent?.trim()).filter(Boolean)
    );
  for (const label of options) {
    if (label && label !== "Select a company") console.log(label);
  }
}

async function selectOptionContaining(page: Page, selector: string, needle: string) {
  const value = await page.locator(selector).evaluate((el, needle) => {
    const select = el as HTMLSelectElement;
    const match = Array.from(select.options).find((o) =>
      o.textContent?.toLowerCase().includes(needle.toLowerCase())
    );
    return match?.value ?? null;
  }, needle);

  if (!value) {
    throw new Error(
      `No company matching "${needle}" in the dropdown. Run "npm run admin-publish -- --list" to see valid names.`
    );
  }
  await page.selectOption(selector, value);
}

async function publish(page: Page, input: ReportInput, editId?: string) {
  await page.goto(editId ? `${SITE_URL}/admin/reports/${editId}/edit` : `${SITE_URL}/admin/reports/new`);

  await selectOptionContaining(page, 'select[name="companyId"]', input.company);
  await page.fill('input[name="year"]', String(input.year));
  await page.selectOption('select[name="period"]', input.period);
  await page.fill('input[name="title"]', input.title);
  await page.fill('textarea[name="summary"]', input.summary);
  if (input.coverImageUrl) {
    await page.fill('input[name="coverImageUrl"]', input.coverImageUrl);
  }
  await page.fill('textarea[name="contentMd"]', input.contentMd);

  const isPublicReportUrl = (url: URL) =>
    url.pathname.startsWith("/reports/") && !url.pathname.startsWith("/admin");

  await Promise.all([
    page.waitForURL(isPublicReportUrl, { timeout: 15_000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  if (!isPublicReportUrl(new URL(page.url()))) {
    const errorText = await page.locator(".bg-red-50").first().textContent().catch(() => null);
    const screenshotPath = join(tmpdir(), `admin-publish-failure-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath }).catch(() => null);
    fail(
      `Publish did not succeed (stuck on ${page.url()}).${errorText ? ` Form error: ${errorText.trim()}` : ""} Screenshot: ${screenshotPath}`
    );
  }

  console.log(`${editId ? "Updated" : "Published"}: ${input.title}`);
  console.log(`View: ${page.url()}`);
  console.log(`Edit: ${page.url().replace("/reports/", "/admin/reports/")}/edit`);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    fail("Usage: npm run admin-publish -- --list | path/to/report.json | --edit <reportId> report.json");
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await login(page);

    if (arg === "--list") {
      await listCompanies(page);
    } else if (arg === "--edit") {
      const editId = process.argv[3];
      const jsonPath = process.argv[4];
      if (!editId || !jsonPath) {
        fail("Usage: npm run admin-publish -- --edit <reportId> report.json");
      }
      const input = loadInput(jsonPath);
      await publish(page, input, editId);
    } else {
      const input = loadInput(arg);
      await publish(page, input);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
