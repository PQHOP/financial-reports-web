/**
 * Prints every company's slug, name, ticker, and industries, so a Claude
 * Code session can find the right companySlug before running
 * publish-report.ts. Read-only; safe to run anytime.
 *
 * Usage: npm run list-companies
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    include: { industries: true },
    orderBy: { name: "asc" },
  });

  for (const c of companies) {
    const industries = c.industries.map((i) => i.name).join(", ");
    console.log(`${c.slug}\t${c.name}${c.ticker ? ` (${c.ticker})` : ""}\t[${industries}]`);
  }

  console.log(`\n${companies.length} companies total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
