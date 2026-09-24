// Fetching and parsing the public feeds behind the daily market brief.
// No XML dependency: the feeds are simple RSS 2.0 / Atom and we only need
// title, link, a short description and a date.

export type FeedSource = {
  name: string;
  url: string;
  // Official sources are primary documents; press is used to know what is
  // being talked about and is only ever paraphrased with a link back.
  kind: "official" | "press" | "filings";
};

export const FEEDS: FeedSource[] = [
  {
    name: "Federal Reserve",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    kind: "official",
  },
  {
    name: "U.S. SEC",
    url: "https://www.sec.gov/news/pressreleases.rss",
    kind: "official",
  },
  {
    name: "U.S. BLS",
    url: "https://www.bls.gov/feed/bls_latest.rss",
    kind: "official",
  },
  {
    name: "SEC EDGAR (8-K)",
    url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&count=100&output=atom",
    kind: "filings",
  },
  {
    name: "CNBC",
    url: "https://www.cnbc.com/id/10000664/device/rss/rss.html",
    kind: "press",
  },
  {
    name: "MarketWatch",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    kind: "press",
  },
  {
    name: "Yahoo Finance",
    url: "https://finance.yahoo.com/news/rssindex",
    kind: "press",
  },
];

export type FeedItem = {
  source: string;
  kind: FeedSource["kind"];
  title: string;
  url: string;
  snippet: string;
  publishedAt: Date | null;
};

// SEC blocks undeclared user agents (see CLAUDE.md); harmless for the others.
const USER_AGENT =
  "FinancialReportInsights research-tool contact@financial-reports-web.vercel.app";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const num =
        code[1].toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(num) && num > 0 && num < 0x110000
        ? String.fromCodePoint(num)
        : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function clean(raw: string): string {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Decode first so entity-encoded markup in descriptions is stripped too.
  return decodeEntities(unwrapped)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const match = block.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")
  );
  return match ? clean(match[1]) : "";
}

function link(block: string): string {
  const href = block.match(/<link[^>]*\shref=["']([^"']+)["']/i);
  if (href) return decodeEntities(href[1]);
  return tag(block, "link");
}

export function parseFeed(xml: string, source: FeedSource): FeedItem[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const items: FeedItem[] = [];
  for (const block of blocks) {
    const title = tag(block, "title");
    const url = link(block);
    if (!title || !/^https?:\/\//i.test(url)) continue;
    const dateText =
      tag(block, "pubDate") ||
      tag(block, "published") ||
      tag(block, "updated") ||
      tag(block, "dc:date");
    const parsed = dateText ? new Date(dateText) : null;
    items.push({
      source: source.name,
      kind: source.kind,
      title,
      url,
      snippet: (tag(block, "description") || tag(block, "summary")).slice(0, 320),
      publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
    });
  }
  return items;
}

export async function fetchFeed(source: FeedSource): Promise<FeedItem[]> {
  const response = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
  return parseFeed(await response.text(), source);
}
