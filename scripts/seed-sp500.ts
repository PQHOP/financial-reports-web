/**
 * One-time bulk import of the S&P 500 constituents (ticker, name, country,
 * exchange, GICS sector) as Company + Industry directory entries — no
 * reports. Source: Wikipedia's "List of S&P 500 companies" table, parsed and
 * hand-corrected for HQ/country (see scripts/parse-sp500.js and
 * scripts/build-sp500-data.js).
 *
 * Idempotent (upsert by slug) and additive only — never deletes existing
 * data, unlike prisma/seed.ts's demo dataset.
 */
import { prisma } from "../src/lib/prisma";
import sp500 from "./data/sp500.json";

function slugifyIndustry(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function main() {
  let created = 0;
  let updated = 0;

  for (const c of sp500) {
    const industrySlug = slugifyIndustry(c.industry);
    const existing = await prisma.company.findUnique({ where: { slug: c.slug } });

    await prisma.company.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        ticker: c.ticker,
        country: c.country,
        exchange: c.exchange,
        industries: {
          connectOrCreate: {
            where: { slug: industrySlug },
            create: { slug: industrySlug, name: c.industry },
          },
        },
      },
      update: {
        name: c.name,
        ticker: c.ticker,
        country: c.country,
        exchange: c.exchange,
        industries: {
          connectOrCreate: {
            where: { slug: industrySlug },
            create: { slug: industrySlug, name: c.industry },
          },
        },
      },
    });

    if (existing) updated++;
    else created++;
  }

  const companyCount = await prisma.company.count();
  const industryCount = await prisma.industry.count();
  console.log(
    `Done. Created ${created}, updated ${updated}. DB now has ${companyCount} companies across ${industryCount} industries.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
