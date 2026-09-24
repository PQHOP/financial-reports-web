import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { systemReports } from "@/lib/community";
import { periodLabels } from "@/lib/period";
import { metricsHeadline, readMetrics } from "@/lib/metrics";
import { FEEDS, fetchFeed, type FeedItem } from "@/lib/newsFeeds";

// Model for the daily brief. Override with NEWS_MODEL (e.g. claude-sonnet-5
// to cut the cost roughly in half).
const MODEL = process.env.NEWS_MODEL || "claude-opus-5";

const HOUR_MS = 60 * 60 * 1000;
const MAX_PRESS_ITEMS = 40;
const MAX_FILING_ITEMS = 15;
export const MIN_ITEMS = 8;

type SourceItem = FeedItem & { id: string };

type CompanyContext = {
  ticker: string;
  name: string;
  reportId: string;
  label: string;
  headline: string;
};

type ModelStory = {
  headline: string;
  what_happened: string;
  why_it_matters: string;
  tickers: string[];
  source_ids: string[];
};

type ModelBrief = {
  title: string;
  summary: string;
  intro: string;
  stories: ModelStory[];
  watch: string[];
};

export type Brief = {
  title: string;
  summary: string;
  contentMd: string;
  tickers: string[];
  itemCount: number;
  storyCount: number;
  droppedStories: number;
  model: string;
  usage: { input: number; output: number };
};

const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    intro: { type: "string" },
    stories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          headline: { type: "string" },
          what_happened: { type: "string" },
          why_it_matters: { type: "string" },
          tickers: { type: "array", items: { type: "string" } },
          source_ids: { type: "array", items: { type: "string" } },
        },
        required: [
          "headline",
          "what_happened",
          "why_it_matters",
          "tickers",
          "source_ids",
        ],
        additionalProperties: false,
      },
    },
    watch: { type: "array", items: { type: "string" } },
  },
  required: ["title", "summary", "intro", "stories", "watch"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You write the daily market brief for Financial Report Insights, a site that explains company earnings reports to people with no finance background.

You are given numbered source items (headlines and short descriptions from public feeds: official releases, SEC 8-K filings, and financial press) plus a list of companies the site has published earnings analyses for.

Rules, in priority order:
1. Use ONLY facts stated in the source items. Never add figures, quotes, causes or background from memory. If an item is just a headline with no detail, say what it reports and no more.
2. Every dollar amount or percentage you write must appear in the cited source items or in the site's own figures given for a company. Do not compute new numbers.
3. Paraphrase in your own words. Do not copy sentences from the sources.
4. Separate what was reported (what_happened) from your reading of it (why_it_matters). Say "may" or "could" for anything that is interpretation, and never present a prediction as fact.
5. No investment advice: no buy/sell/hold language, no price targets.
6. Pick up to 6 stories that matter most to someone following listed companies and the economy; fewer is better than padding. Skip celebrity, crypto-price chatter, personal-finance advice columns and pure opinion pieces. A story whose only support is a bare headline with no detail is allowed only if it comes from an official source or an 8-K; otherwise skip it. Merge items about the same event into one story and cite all of them.
7. A decision or action by a central bank, regulator, court or government (a rate change, a ruling, a sanction, a bankruptcy filing) may be reported only if an official source item states it, or at least two independent items from different sources do. A passing mention inside a column or a roundup is not enough: skip it.
8. Do not characterize beyond the source: no "surprise", "shock", "record" or "sharply" unless a cited item uses that idea. Do not name a company unless a cited item names it. Put a company's ticker in "tickers" only when a cited item names that company, and then you may connect the story to the site's own latest figures exactly as given; at most 3 tickers per story.
9. Plain, specific sentences. Explain any finance term the first time it matters. No filler such as "robust", "testament to", "in today's dynamic environment". Do not put URLs or markdown links in any field; sources are attached from source_ids.

Fields: "title" is a news headline for the day, under 50 characters, that a reader could search for: name the 2 or 3 biggest specific events, institutions or companies from your stories (in the style "Fed holds rates, chipmaker results lift tech", but about the actual stories). No date, no figures, no vague themes such as "markets in focus" or "busy day ahead", and only companies or events that a cited item names (rule 8). "summary" is one sentence under 155 characters, shown in search results: open with the most important events and name the companies or institutions involved, plainly and without hype. "intro" is 2 to 3 sentences on the day's main thread. "watch" is 2 to 4 short bullets on scheduled or pending things mentioned in the sources; use an empty list if the sources name none.`;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word &&
        !["inc", "corp", "corporation", "co", "company", "ltd", "plc", "the", "holdings", "group", "limited"].includes(word)
    )
    .join(" ");
}

async function loadCompanies(): Promise<CompanyContext[]> {
  const reports = await prisma.report.findMany({
    where: systemReports,
    orderBy: { publishedAt: "desc" },
    include: { company: { select: { name: true, ticker: true } } },
  });
  const seen = new Set<string>();
  const companies: CompanyContext[] = [];
  for (const report of reports) {
    const ticker = report.company.ticker;
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    const metrics = readMetrics(report.metrics);
    companies.push({
      ticker,
      name: report.company.name,
      reportId: report.id,
      label: `${ticker} ${periodLabels[report.period]} ${report.year} analysis`,
      headline: metrics ? metricsHeadline(metrics) : "",
    });
  }
  return companies;
}

async function collectItems(
  companies: CompanyContext[],
  windowMs: number
): Promise<{ items: SourceItem[]; failures: string[] }> {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const failures: string[] = [];
  const all: FeedItem[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") all.push(...result.value);
    else failures.push(`${FEEDS[index].name}: ${String(result.reason)}`);
  });

  const cutoff = Date.now() - windowMs;
  const fresh = all.filter((item) =>
    item.publishedAt
      ? item.publishedAt.getTime() >= cutoff
      : item.kind === "official"
  );

  const trackedNames = new Set(companies.map((c) => normalizeName(c.name)));
  const official = fresh.filter((item) => item.kind === "official");
  const filings = fresh
    .filter((item) => item.kind === "filings")
    .flatMap((item) => {
      // EDGAR titles look like "8-K - Apple Inc. (0000320193) (Filer)".
      const filer = item.title.match(/^\S+\s+-\s+(.+?)\s+\(\d+\)/)?.[1];
      if (!filer || !trackedNames.has(normalizeName(filer))) return [];
      return [{ ...item, title: `8-K filing by ${filer}` }];
    })
    .slice(0, MAX_FILING_ITEMS);

  const seenTitles = new Set<string>();
  const seenUrls = new Set<string>();
  const press = fresh
    .filter((item) => item.kind === "press")
    .sort(
      (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
    )
    .filter((item) => {
      const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seenTitles.has(key) || seenUrls.has(item.url)) return false;
      seenTitles.add(key);
      seenUrls.add(item.url);
      return true;
    })
    .slice(0, MAX_PRESS_ITEMS);

  const items = [...official, ...filings, ...press].map((item, index) => ({
    ...item,
    id: `s${index + 1}`,
  }));
  return { items, failures };
}

function numbersIn(text: string): Set<string> {
  const found = text.match(/\d[\d,]*\.?\d*/g) ?? [];
  return new Set(found.map((n) => n.replace(/,/g, "").replace(/\.$/, "")));
}

// Dollar amounts and percentages in generated text must appear in the material
// the story cites. Anything else is treated as invented and the story dropped.
function hasUnsupportedFigures(text: string, allowed: Set<string>): boolean {
  const figures = [
    ...text.matchAll(/\$\s?(\d[\d,]*\.?\d*)/g),
    ...text.matchAll(/(\d[\d,]*\.?\d*)\s?(?:%|percent)/gi),
  ];
  return figures.some((match) => {
    const value = match[1].replace(/,/g, "").replace(/\.$/, "");
    return !allowed.has(value);
  });
}

// Sources are attached by us from source_ids, so any link the model writes
// anyway is reduced to its text.
function stripLinks(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function renderItems(items: SourceItem[]): string {
  return items
    .map(
      (item) =>
        `[${item.id}] (${item.source}${item.publishedAt ? `, ${item.publishedAt.toISOString().slice(0, 16)}Z` : ""}) ${item.title}${item.snippet ? `\n    ${item.snippet}` : ""}`
    )
    .join("\n");
}

function renderCompanies(companies: CompanyContext[]): string {
  return companies
    .map(
      (c) =>
        `${c.ticker} | ${c.name} | latest analysis: ${c.label}${c.headline ? ` | ${c.headline}` : ""}`
    )
    .join("\n");
}

// Validates the model's draft against the source items and renders the article.
// Pure (no I/O) so it can be tested without an API key or a database.
export function assembleBrief(
  draft: ModelBrief,
  items: SourceItem[],
  companies: CompanyContext[],
  dateLabel: string
) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const companiesByTicker = new Map(companies.map((c) => [c.ticker, c]));
  const siteFigures = numbersIn(renderCompanies(companies));

  const kept: { story: ModelStory; sources: SourceItem[]; tickers: string[] }[] = [];
  const keptFigures = new Set<string>();
  for (const story of draft.stories) {
    const sources = [...new Set(story.source_ids ?? [])]
      .map((id) => itemsById.get(id))
      .filter((item): item is SourceItem => Boolean(item));
    if (sources.length === 0 || !story.headline || !story.what_happened) continue;

    const allowed = new Set([
      ...numbersIn(sources.map((s) => `${s.title} ${s.snippet}`).join(" ")),
      ...siteFigures,
    ]);
    const body = `${story.headline} ${story.what_happened} ${story.why_it_matters}`;
    if (hasUnsupportedFigures(body, allowed)) continue;
    allowed.forEach((n) => keptFigures.add(n));

    // Link a company only when a cited item actually names it (by name or
    // by ticker); a sector-level connection is not a mention.
    const citedText = sources.map((s) => `${s.title} ${s.snippet}`).join(" ");
    const citedNormalized = normalizeName(citedText);
    const named = [...new Set(story.tickers ?? [])]
      .filter((t) => companiesByTicker.has(t))
      .filter((t) => {
        const company = companiesByTicker.get(t)!;
        const name = normalizeName(company.name);
        return (
          (name.length >= 3 && citedNormalized.includes(name)) ||
          (t.length >= 3 && new RegExp(`\\b${t.replace(/[^A-Z0-9]/g, "\\$&")}\\b`).test(citedText))
        );
      })
      .slice(0, 3);

    kept.push({ story, sources, tickers: named });
  }
  if (kept.length < 3) {
    throw new Error(
      `Only ${kept.length} stories passed validation (of ${draft.stories.length}).`
    );
  }

  const sections = kept.map(({ story, sources, tickers }) => {
    const lines = [
      `## ${stripLinks(story.headline)}`,
      "",
      stripLinks(story.what_happened),
      "",
      `**Why it matters.** ${stripLinks(story.why_it_matters)}`,
    ];
    if (tickers.length > 0) {
      const links = tickers.map((t) => {
        const c = companiesByTicker.get(t)!;
        return `[${c.label}](/reports/${c.reportId})`;
      });
      lines.push("", `*On this site:* ${links.join(" · ")}`);
    }
    const counts = new Map<string, number>();
    const sourceLinks = sources.map((s) => {
      const n = (counts.get(s.source) ?? 0) + 1;
      counts.set(s.source, n);
      return `[${s.source}${n > 1 ? ` (${n})` : ""}](${s.url})`;
    });
    lines.push("", `*Sources:* ${sourceLinks.join(" · ")}`);
    return lines.join("\n");
  });

  const watch = (draft.watch ?? []).map(stripLinks).filter(Boolean).slice(0, 4);
  const contentMd = [
    `> **Takeaway:** ${stripLinks(draft.intro)}`,
    ...sections,
    ...(watch.length > 0
      ? [`## What to watch next\n\n${watch.map((w) => `- ${w}`).join("\n")}`]
      : []),
    `---\n\n*This brief is written automatically by an AI system from public feeds (official releases, SEC filings and financial press headlines). It paraphrases and links to each source and may miss context in the full articles, so check the linked sources before relying on it. For information only; not investment advice.*`,
  ].join("\n\n");

  const tickers = [...new Set(kept.flatMap((k) => k.tickers))];

  // The headline goes first because search results truncate from the right,
  // and it is held to the same figure check as the stories. If it fails, fall
  // back to the first kept story's (already validated) headline.
  const headline = stripLinks(draft.title);
  const theme = headline && !hasUnsupportedFigures(headline, keptFigures)
    ? headline
    : stripLinks(kept[0].story.headline);
  return {
    title: `${clip(theme, 60)} – Market Brief, ${dateLabel}`,
    summary: clip(stripLinks(draft.summary), 160),
    contentMd,
    tickers,
    storyCount: kept.length,
    droppedStories: draft.stories.length - kept.length,
  };
}

// windowHours: how far back to read the feeds (longer on Mondays to cover the
// weekend, when no brief is published).
export async function buildBrief(
  dateLabel: string,
  windowHours = 30
): Promise<Brief | { skipped: string; failures: string[] }> {
  const companies = await loadCompanies();
  const { items, failures } = await collectItems(companies, windowHours * HOUR_MS);
  if (items.length < MIN_ITEMS) {
    return {
      skipped: `Only ${items.length} usable items (need ${MIN_ITEMS}).`,
      failures,
    };
  }

  const client = new Anthropic({ timeout: 240_000 });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: BRIEF_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Date: ${dateLabel} (UTC)\n\nSOURCE ITEMS\n${renderItems(items)}\n\nCOMPANIES WITH SITE ANALYSES\n${renderCompanies(companies)}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Model refused the request.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Model output was cut off (max_tokens).");
  }
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("No text in model response.");

  let draft: ModelBrief;
  try {
    draft = JSON.parse(text.text) as ModelBrief;
  } catch {
    throw new Error("Model output was not valid JSON.");
  }
  if (!draft.title || !draft.summary || !draft.intro || !Array.isArray(draft.stories)) {
    throw new Error("Model output is missing required fields.");
  }

  const assembled = assembleBrief(draft, items, companies, dateLabel);
  return {
    ...assembled,
    itemCount: items.length,
    model: response.model,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}
