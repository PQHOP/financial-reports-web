import { PrismaClient, ReportPeriod } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type CompanySeed = {
  slug: string;
  name: string;
  ticker: string;
  country: string;
  exchange: string;
  industries: string[];
};

const companies: CompanySeed[] = [
  { slug: "aapl", name: "Apple Inc.", ticker: "AAPL", country: "United States", exchange: "NASDAQ", industries: ["Technology", "Consumer Electronics"] },
  { slug: "msft", name: "Microsoft Corporation", ticker: "MSFT", country: "United States", exchange: "NASDAQ", industries: ["Technology", "Software"] },
  { slug: "googl", name: "Alphabet Inc.", ticker: "GOOGL", country: "United States", exchange: "NASDAQ", industries: ["Technology", "Media & Entertainment"] },
  { slug: "amzn", name: "Amazon.com, Inc.", ticker: "AMZN", country: "United States", exchange: "NASDAQ", industries: ["Technology", "Consumer Retail"] },
  { slug: "meta", name: "Meta Platforms, Inc.", ticker: "META", country: "United States", exchange: "NASDAQ", industries: ["Technology", "Media & Entertainment"] },
  { slug: "nvda", name: "NVIDIA Corporation", ticker: "NVDA", country: "United States", exchange: "NASDAQ", industries: ["Technology", "Semiconductors"] },
  { slug: "tsla", name: "Tesla, Inc.", ticker: "TSLA", country: "United States", exchange: "NASDAQ", industries: ["Automotive", "Technology", "Energy"] },
  { slug: "intc", name: "Intel Corporation", ticker: "INTC", country: "United States", exchange: "NASDAQ", industries: ["Technology", "Semiconductors"] },
  { slug: "nflx", name: "Netflix, Inc.", ticker: "NFLX", country: "United States", exchange: "NASDAQ", industries: ["Technology", "Media & Entertainment"] },
  { slug: "005930", name: "Samsung Electronics Co., Ltd.", ticker: "005930", country: "South Korea", exchange: "KRX", industries: ["Technology", "Semiconductors", "Consumer Electronics"] },
  { slug: "tsm", name: "Taiwan Semiconductor Manufacturing Company", ticker: "TSM", country: "Taiwan", exchange: "TWSE", industries: ["Technology", "Semiconductors"] },
  { slug: "sony", name: "Sony Group Corporation", ticker: "6758", country: "Japan", exchange: "TSE", industries: ["Technology", "Consumer Electronics", "Media & Entertainment"] },

  { slug: "brk-b", name: "Berkshire Hathaway Inc.", ticker: "BRK.B", country: "United States", exchange: "NYSE", industries: ["Financial Services", "Insurance"] },
  { slug: "jpm", name: "JPMorgan Chase & Co.", ticker: "JPM", country: "United States", exchange: "NYSE", industries: ["Financial Services"] },
  { slug: "bac", name: "Bank of America Corporation", ticker: "BAC", country: "United States", exchange: "NYSE", industries: ["Financial Services"] },
  { slug: "gs", name: "Goldman Sachs Group, Inc.", ticker: "GS", country: "United States", exchange: "NYSE", industries: ["Financial Services"] },
  { slug: "v", name: "Visa Inc.", ticker: "V", country: "United States", exchange: "NYSE", industries: ["Financial Services", "Technology"] },
  { slug: "ma", name: "Mastercard Incorporated", ticker: "MA", country: "United States", exchange: "NYSE", industries: ["Financial Services", "Technology"] },
  { slug: "hsbc", name: "HSBC Holdings plc", ticker: "HSBA", country: "United Kingdom", exchange: "LSE", industries: ["Financial Services"] },
  { slug: "unh", name: "UnitedHealth Group Incorporated", ticker: "UNH", country: "United States", exchange: "NYSE", industries: ["Healthcare & Pharmaceuticals", "Insurance"] },
  { slug: "vcb", name: "Joint Stock Commercial Bank for Foreign Trade of Vietnam (Vietcombank)", ticker: "VCB", country: "Vietnam", exchange: "HOSE", industries: ["Financial Services"] },
  { slug: "tcb", name: "Vietnam Technological and Commercial Joint Stock Bank (Techcombank)", ticker: "TCB", country: "Vietnam", exchange: "HOSE", industries: ["Financial Services"] },
  { slug: "hdb-in", name: "HDFC Bank Limited", ticker: "HDB", country: "India", exchange: "NSE", industries: ["Financial Services"] },
  { slug: "icbc", name: "Industrial and Commercial Bank of China Limited", ticker: "1398", country: "China", exchange: "HKEX", industries: ["Financial Services"] },

  { slug: "jnj", name: "Johnson & Johnson", ticker: "JNJ", country: "United States", exchange: "NYSE", industries: ["Healthcare & Pharmaceuticals"] },
  { slug: "pfe", name: "Pfizer Inc.", ticker: "PFE", country: "United States", exchange: "NYSE", industries: ["Healthcare & Pharmaceuticals"] },
  { slug: "nvo", name: "Novo Nordisk A/S", ticker: "NVO", country: "Denmark", exchange: "CPH", industries: ["Healthcare & Pharmaceuticals"] },
  { slug: "roche", name: "Roche Holding AG", ticker: "ROG", country: "Switzerland", exchange: "SIX", industries: ["Healthcare & Pharmaceuticals"] },

  { slug: "toyota", name: "Toyota Motor Corporation", ticker: "7203", country: "Japan", exchange: "TSE", industries: ["Automotive"] },
  { slug: "vow3", name: "Volkswagen AG", ticker: "VOW3", country: "Germany", exchange: "FSE", industries: ["Automotive"] },
  { slug: "f", name: "Ford Motor Company", ticker: "F", country: "United States", exchange: "NYSE", industries: ["Automotive"] },
  { slug: "byd", name: "BYD Company Limited", ticker: "1211", country: "China", exchange: "HKEX", industries: ["Automotive", "Technology", "Energy"] },

  { slug: "xom", name: "ExxonMobil Corporation", ticker: "XOM", country: "United States", exchange: "NYSE", industries: ["Energy"] },
  { slug: "aramco", name: "Saudi Arabian Oil Company (Saudi Aramco)", ticker: "2222", country: "Saudi Arabia", exchange: "Tadawul", industries: ["Energy"] },
  { slug: "shel", name: "Shell plc", ticker: "SHEL", country: "United Kingdom", exchange: "LSE", industries: ["Energy"] },

  { slug: "wmt", name: "Walmart Inc.", ticker: "WMT", country: "United States", exchange: "NYSE", industries: ["Consumer Retail"] },
  { slug: "cost", name: "Costco Wholesale Corporation", ticker: "COST", country: "United States", exchange: "NASDAQ", industries: ["Consumer Retail"] },
  { slug: "ko", name: "The Coca-Cola Company", ticker: "KO", country: "United States", exchange: "NYSE", industries: ["Consumer Goods"] },
  { slug: "pep", name: "PepsiCo, Inc.", ticker: "PEP", country: "United States", exchange: "NASDAQ", industries: ["Consumer Goods"] },
  { slug: "nestle", name: "Nestlé S.A.", ticker: "NESN", country: "Switzerland", exchange: "SIX", industries: ["Consumer Goods"] },
  { slug: "pg", name: "Procter & Gamble Co.", ticker: "PG", country: "United States", exchange: "NYSE", industries: ["Consumer Goods"] },
  { slug: "lvmh", name: "LVMH Moët Hennessy Louis Vuitton SE", ticker: "MC", country: "France", exchange: "Euronext Paris", industries: ["Consumer Goods", "Consumer Retail"] },

  { slug: "dis", name: "The Walt Disney Company", ticker: "DIS", country: "United States", exchange: "NYSE", industries: ["Media & Entertainment"] },
  { slug: "att", name: "AT&T Inc.", ticker: "T", country: "United States", exchange: "NYSE", industries: ["Telecommunications"] },
  { slug: "vz", name: "Verizon Communications Inc.", ticker: "VZ", country: "United States", exchange: "NYSE", industries: ["Telecommunications"] },
  { slug: "vod", name: "Vodafone Group Plc", ticker: "VOD", country: "United Kingdom", exchange: "LSE", industries: ["Telecommunications"] },

  { slug: "ba", name: "Boeing Company", ticker: "BA", country: "United States", exchange: "NYSE", industries: ["Industrials & Manufacturing", "Aerospace & Defense"] },
  { slug: "air", name: "Airbus SE", ticker: "AIR", country: "France", exchange: "Euronext Paris", industries: ["Industrials & Manufacturing", "Aerospace & Defense"] },
  { slug: "dal", name: "Delta Air Lines, Inc.", ticker: "DAL", country: "United States", exchange: "NYSE", industries: ["Airlines"] },
  { slug: "sia", name: "Singapore Airlines Limited", ticker: "C6L", country: "Singapore", exchange: "SGX", industries: ["Airlines"] },

  { slug: "pld", name: "Prologis, Inc.", ticker: "PLD", country: "United States", exchange: "NYSE", industries: ["Real Estate"] },
];

const vcbContent = `## Overview

Vietcombank (VCB) delivered a solid Q2 2026, with pre-tax profit growth driven by resilient credit expansion and disciplined provisioning. Net interest margin held steady despite sector-wide funding cost pressure.

![Quarterly pre-tax profit trend for Vietcombank, showing steady growth over the last five quarters](https://placehold.co/900x420/1d4ed8/ffffff?text=Pre-tax+Profit+Trend)

## Key Financial Metrics

| Metric | Q2 2026 | Q2 2025 | YoY Change |
| --- | --- | --- | --- |
| Net interest income | VND 15,200bn | VND 13,900bn | +9.4% |
| Pre-tax profit | VND 10,850bn | VND 9,700bn | +11.9% |
| NPL ratio | 0.98% | 1.05% | -7bps |
| NIM | 3.20% | 3.24% | -4bps |

> **Takeaway:** Credit growth outpaced deposit growth this quarter, and management reiterated its full-year credit growth target, which implies an acceleration in H2.

## Segment Performance

Retail lending remained the primary growth engine, while corporate lending growth was more moderate as large corporates continued to tap the bond market for funding.

![Loan book breakdown by segment: retail, SME, and corporate](https://placehold.co/900x420/2563eb/ffffff?text=Loan+Book+by+Segment)

## Outlook

Management guided for continued NIM stability in H2 2026, supported by a favorable funding mix and disciplined cost-of-funds management. We view the current valuation as reasonable relative to the bank's return on equity profile.`;

const aaplQ2Content = `## Overview

Apple posted another quarter of broad-based growth, with Services once again outpacing hardware and setting a new all-time revenue record for the segment.

![Apple total revenue by quarter over the trailing eight quarters](https://placehold.co/900x420/111827/ffffff?text=Revenue+by+Quarter)

## Key Financial Metrics

| Metric | Q2 2026 | Q2 2025 | YoY Change |
| --- | --- | --- | --- |
| Revenue | $94.8B | $85.8B | +10.5% |
| Gross margin | 46.8% | 45.2% | +160bps |
| Services revenue | $26.3B | $23.9B | +10.0% |
| Diluted EPS | $1.58 | $1.35 | +17.0% |

> **Takeaway:** Gross margin expansion was driven by a richer product mix and continued growth in the higher-margin Services business.

## Segment Performance

iPhone revenue grew modestly, while Services and Wearables both posted double-digit growth. Greater China returned to growth after two soft quarters.

![Revenue split by product category: iPhone, Services, Mac, iPad, Wearables](https://placehold.co/900x420/374151/ffffff?text=Revenue+by+Segment)

## Outlook

Management guided for continued double-digit Services growth next quarter, with overall revenue growth expected in the mid-to-high single digits, consistent with the current consensus range.`;

const aaplAnnualContent = `## Overview

Fiscal year 2025 was a record year for Apple, with full-year revenue reaching an all-time high on the back of resilient demand across nearly all product categories and geographies.

![Full fiscal year revenue for the last five years](https://placehold.co/900x420/111827/ffffff?text=FY+Revenue%2C+5-Year+Trend)

## Key Financial Metrics

| Metric | FY2025 | FY2024 | YoY Change |
| --- | --- | --- | --- |
| Revenue | $412.3B | $391.0B | +5.4% |
| Operating income | $128.6B | $119.4B | +7.7% |
| Free cash flow | $108.9B | $101.2B | +7.6% |
| Diluted EPS | $7.12 | $6.35 | +12.1% |

> **Takeaway:** Free cash flow generation remained exceptionally strong, funding continued share buybacks and dividend growth without pressuring the balance sheet.

## Capital Return

The Board authorized a new buyback program during the year, and the company returned over $100B to shareholders through buybacks and dividends combined.

## Outlook

Management did not provide formal full-year guidance but highlighted continued investment in AI-related silicon and services infrastructure as a priority for FY2026.`;

async function main() {
  await prisma.report.deleteMany();
  await prisma.company.deleteMany();
  await prisma.industry.deleteMany();

  const companyIdBySlug = new Map<string, string>();

  for (const c of companies) {
    const company = await prisma.company.create({
      data: {
        slug: c.slug,
        name: c.name,
        ticker: c.ticker,
        country: c.country,
        exchange: c.exchange,
        industries: {
          connectOrCreate: c.industries.map((name) => ({
            where: { slug: slugify(name) },
            create: { slug: slugify(name), name },
          })),
        },
      },
    });
    companyIdBySlug.set(c.slug, company.id);
  }

  await prisma.report.create({
    data: {
      companyId: companyIdBySlug.get("vcb")!,
      year: 2026,
      period: ReportPeriod.Q2,
      title: "VCB — Q2 2026 Financial Report Analysis",
      summary:
        "Pre-tax profit grew 11.9% YoY on resilient credit growth and stable margins, with asset quality continuing to improve.",
      contentMd: vcbContent,
      coverImageUrl: "https://placehold.co/1200x630/1d4ed8/ffffff?text=VCB+Q2+2026",
      author: "Claude",
    },
  });

  await prisma.report.create({
    data: {
      companyId: companyIdBySlug.get("aapl")!,
      year: 2026,
      period: ReportPeriod.Q2,
      title: "AAPL — Q2 2026 Financial Report Analysis",
      summary:
        "Services revenue hit a new all-time high and gross margin expanded 160bps YoY on a richer product mix.",
      contentMd: aaplQ2Content,
      coverImageUrl: "https://placehold.co/1200x630/111827/ffffff?text=AAPL+Q2+2026",
      author: "Claude",
    },
  });

  await prisma.report.create({
    data: {
      companyId: companyIdBySlug.get("aapl")!,
      year: 2025,
      period: ReportPeriod.ANNUAL,
      title: "AAPL — FY2025 Annual Report Analysis",
      summary:
        "Record full-year revenue and free cash flow generation, with over $100B returned to shareholders.",
      contentMd: aaplAnnualContent,
      coverImageUrl: "https://placehold.co/1200x630/374151/ffffff?text=AAPL+FY2025",
      author: "Claude",
    },
  });

  const industryCount = await prisma.industry.count();
  const companyCount = await prisma.company.count();
  console.log(`Seed data created: ${companyCount} companies across ${industryCount} industries.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
