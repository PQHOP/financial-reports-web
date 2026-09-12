import { PrismaClient, ReportPeriod } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

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

  const banking = await prisma.industry.create({
    data: { slug: "banking-financial-services", name: "Banking & Financial Services" },
  });

  const tech = await prisma.industry.create({
    data: { slug: "technology", name: "Technology" },
  });

  const vcb = await prisma.company.create({
    data: {
      slug: "vcb",
      name: "Joint Stock Commercial Bank for Foreign Trade of Vietnam (Vietcombank)",
      ticker: "VCB",
      country: "Vietnam",
      exchange: "HOSE",
      industryId: banking.id,
    },
  });

  const aapl = await prisma.company.create({
    data: {
      slug: "aapl",
      name: "Apple Inc.",
      ticker: "AAPL",
      country: "United States",
      exchange: "NASDAQ",
      industryId: tech.id,
    },
  });

  await prisma.report.create({
    data: {
      companyId: vcb.id,
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
      companyId: aapl.id,
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
      companyId: aapl.id,
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

  console.log("Seed data created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
