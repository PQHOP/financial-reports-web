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
 *   npm run admin-publish -- --article article.json         # publish/update an editorial article
 *   npm run admin-publish -- --articles-dir content/guides   # publish/update every .md/.json in a folder
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
 *   "coverImageUrl": "https://...",  // optional; never use placehold.co
 *   "sourceUrl": "https://www.sec.gov/Archives/edgar/data/...",  // primary filing
 *   "metrics": { "revenue": 94930, "revenueYoyPct": 6.0, "netIncome": 21448,
 *                "netIncomeYoyPct": 9.3, "epsDiluted": 1.4, "epsYoyPct": 12.0,
 *                "operatingMarginPct": 30.2, "currency": "USD" }
 *                // optional; money in millions, percentages as plain numbers.
 *                // Banks/insurers add their own fields (netInterestMarginPct,
 *                // combinedRatioPct, ...): see ReportMetrics in src/lib/metrics.ts
 * }
 *
 * Article JSON shape (--article; upserts by slug, so re-running updates it):
 * {
 *   "slug": "how-to-read-a-10-q",
 *   "kind": "GUIDE",            // GUIDE PREVIEW COMPARISON SCORECARD
 *   "title": "...",
 *   "summary": "One sentence.",
 *   "contentMd": "## ...",
 *   "tickers": ["AAPL", "MSFT"]  // optional
 * }
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
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
  sourceUrl?: string;
  metrics?: Record<string, unknown>;
};

type ArticleInput = {
  slug: string;
  kind: string;
  title: string;
  summary: string;
  contentMd: string;
  tickers?: string[];
};

const VALID_KINDS = ["GUIDE", "PREVIEW", "COMPARISON", "SCORECARD"];

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
  const result = await page.locator(selector).evaluate((el, needle) => {
    const select = el as HTMLSelectElement;
    const lowerNeedle = needle.toLowerCase();
    const options = Array.from(select.options);
    const matches = options.filter((o) => o.textContent?.toLowerCase().includes(lowerNeedle));

    if (matches.length <= 1) {
      return { value: matches[0]?.value ?? null, ambiguous: null as string[] | null };
    }

    // Ambiguous substring match (e.g. "Apple" also matches "Apple Hospitality
    // REIT" and "Pineapple Financial"). Prefer an exact ticker match, shown
    // in the label as "(TICKER)" — tickers are unique, unlike name substrings.
    const tickerMatch = matches.filter((o) => {
      const text = o.textContent?.toLowerCase() ?? "";
      return text.endsWith(`(${lowerNeedle})`);
    });
    if (tickerMatch.length === 1) {
      return { value: tickerMatch[0].value, ambiguous: null as string[] | null };
    }

    return {
      value: null,
      ambiguous: matches.map((o) => o.textContent?.trim() ?? ""),
    };
  }, needle);

  if (result.ambiguous) {
    throw new Error(
      `"${needle}" matches multiple companies in the dropdown:\n` +
        result.ambiguous.map((label) => `  - ${label}`).join("\n") +
        `\nUse a more specific value, e.g. the exact ticker in parentheses (e.g. "(AAPL)").`
    );
  }
  if (!result.value) {
    throw new Error(
      `No company matching "${needle}" in the dropdown. Run "npm run admin-publish -- --list" to see valid names.`
    );
  }
  await page.selectOption(selector, result.value);
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
  if (input.sourceUrl) {
    await page.fill('input[name="sourceUrl"]', input.sourceUrl);
  }
  if (input.metrics) {
    await page.fill('textarea[name="metrics"]', JSON.stringify(input.metrics));
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
  // Visitors are 308'd from /reports/<id> to this keyword URL (the admin
  // session sees /reports/<id> in place); it's the one search engines index.
  const canonical = await page
    .locator('link[rel="canonical"]')
    .getAttribute("href", { timeout: 5_000 })
    .catch(() => null);
  if (canonical) console.log(`Canonical: ${canonical}`);
}

// Markdown articles carry their fields in a simple "key: value" frontmatter
// block (slug, kind, title, summary, tickers) followed by the body.
function parseMarkdownArticle(raw: string): Partial<ArticleInput> {
  const text = raw.split(String.fromCharCode(13)).join("");
  const lines = text.split("\n");
  const closing = lines.indexOf("---", 1);
  if (lines[0] !== "---" || closing < 0) {
    throw new Error("missing --- frontmatter block");
  }
  const fields: Record<string, string> = {};
  for (const line of lines.slice(1, closing)) {
    const idx = line.indexOf(":");
    if (idx > 0) fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return {
    slug: fields.slug,
    kind: fields.kind,
    title: fields.title,
    summary: fields.summary,
    tickers: fields.tickers
      ? fields.tickers.split(",").map((t) => t.trim()).filter(Boolean)
      : [],
    contentMd: lines.slice(closing + 1).join("\n").trim(),
  };
}

function loadArticle(path: string): ArticleInput {
  let data: Partial<ArticleInput>;
  try {
    const raw = readFileSync(path, "utf-8");
    data = path.endsWith(".md") ? parseMarkdownArticle(raw) : JSON.parse(raw);
  } catch (e) {
    fail(`Could not read/parse ${path}: ${(e as Error).message}`);
  }
  const missing = (["slug", "kind", "title", "summary", "contentMd"] as const).filter(
    (key) => !data[key]
  );
  if (missing.length > 0) fail(`Missing required field(s): ${missing.join(", ")}`);
  if (!VALID_KINDS.includes(data.kind as string)) {
    fail(`Invalid kind "${data.kind}". Must be one of: ${VALID_KINDS.join(", ")}`);
  }
  return data as ArticleInput;
}

async function publishArticle(page: Page, input: ArticleInput) {
  await page.goto(`${SITE_URL}/admin/articles/new`);
  await page.fill('input[name="slug"]', input.slug);
  await page.selectOption('select[name="kind"]', input.kind);
  await page.fill('input[name="title"]', input.title);
  await page.fill('textarea[name="summary"]', input.summary);
  await page.fill('input[name="tickers"]', (input.tickers ?? []).join(", "));
  await page.fill('textarea[name="contentMd"]', input.contentMd);

  const isArticleUrl = (url: URL) =>
    url.pathname.startsWith("/learn/") || url.pathname.startsWith("/insights/");

  await Promise.all([
    page.waitForURL(isArticleUrl, { timeout: 15_000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  if (!isArticleUrl(new URL(page.url()))) {
    const errorText = await page.locator(".bg-red-50").first().textContent().catch(() => null);
    fail(`Article publish did not succeed (stuck on ${page.url()}).${errorText ? ` Form error: ${errorText.trim()}` : ""}`);
  }
  console.log(`Published article: ${input.title}`);
  console.log(`View: ${page.url()}`);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    fail("Usage: npm run admin-publish -- --list | path/to/report.json | --edit <reportId> report.json | --article article.json");
  }

  // Some sandboxes (e.g. the cloud "2026 Report Coverage - Nightly" routine)
  // pre-install a Chromium build at a fixed path instead of the revision
  // Playwright's own installer would fetch — set PLAYWRIGHT_EXECUTABLE_PATH
  // to point at it rather than re-discovering/patching this every run.
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined
  );
  try {
    const page = await browser.newPage();
    await login(page);

    if (arg === "--list") {
      await listCompanies(page);
    } else if (arg === "--articles-dir") {
      const dir = process.argv[3];
      if (!dir) fail("Usage: npm run admin-publish -- --articles-dir content/guides");
      const files = readdirSync(dir).filter((f) => f.endsWith(".md") || f.endsWith(".json")).sort();
      if (files.length === 0) fail(`No .md/.json files in ${dir}`);
      for (const file of files) {
        await publishArticle(page, loadArticle(join(dir, file)));
      }
    } else if (arg === "--article") {
      const jsonPath = process.argv[3];
      if (!jsonPath) fail("Usage: npm run admin-publish -- --article article.json");
      await publishArticle(page, loadArticle(jsonPath));
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
