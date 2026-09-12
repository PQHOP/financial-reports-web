/**
 * Bulk import of all US-listed common stocks (NASDAQ + NYSE + NYSE American
 * + NYSE Arca + Cboe BZX), on top of the S&P 500 seed. Source: NASDAQ
 * Trader's public symbol directory (nasdaqlisted.txt + otherlisted.txt),
 * filtered to exclude ETFs, test issues, warrants/rights/units/preferred/
 * notes — see scripts/parse-us-listed.js for the exact filtering.
 *
 * Unlike the S&P 500 set, this source has no sector/GICS classification, so
 * every company added here (that doesn't already have an industry from the
 * S&P 500 seed) is bucketed into a single "Uncategorized" industry just so
 * it stays reachable via the site's industry -> company navigation, not
 * only via search.
 *
 * Idempotent and additive only: createMany(..., { skipDuplicates: true })
 * by slug, and the industry-attach step only touches companies that
 * currently have zero industries. Safe to re-run.
 */
import { prisma } from "../src/lib/prisma";
import listings from "./data/us-listed.json";

const UNCATEGORIZED_SLUG = "uncategorized";

async function main() {
  const result = await prisma.company.createMany({
    data: listings,
    skipDuplicates: true,
  });
  console.log(`Inserted ${result.count} new companies (skipped existing duplicates by slug).`);

  const uncategorized = await prisma.industry.upsert({
    where: { slug: UNCATEGORIZED_SLUG },
    create: { slug: UNCATEGORIZED_SLUG, name: "Uncategorized" },
    update: {},
  });

  const attached = await prisma.$executeRaw`
    INSERT INTO "_CompanyToIndustry" ("A", "B")
    SELECT c.id, ${uncategorized.id}
    FROM "Company" c
    LEFT JOIN "_CompanyToIndustry" cti ON cti."A" = c.id
    WHERE cti."A" IS NULL
    ON CONFLICT DO NOTHING
  `;
  console.log(`Attached ${attached} previously-uncategorized companies to "Uncategorized".`);

  const companyCount = await prisma.company.count();
  const industryCount = await prisma.industry.count();
  console.log(`DB now has ${companyCount} companies across ${industryCount} industries.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
