import Link from "next/link";
import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";
import { SITE_NAME } from "@/lib/site";

// Dynamic on purpose: src/proxy.ts hands out a per-request CSP nonce, and a
// prerendered page has no nonce for Next's inline bootstrap scripts.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description:
    "What Financial Report Insights is, how the analyses are produced, and what they are not.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <StaticPage title={`About ${SITE_NAME}`} updated="September 28, 2026">
      <p>
        {SITE_NAME} publishes plain-English analysis of the earnings reports
        that publicly listed companies file with regulators. Each report
        covers what the company earned, what changed compared with the same
        period a year earlier, what management said drove the change, and
        what it expects next.
      </p>

      <h2>What you will find here</h2>
      <ul>
        <li>
          <Link href="/reports">Report analyses</Link>: one per company and
          reporting period (quarter, half-year, or full year), organized by
          industry, company, and year.
        </li>
        <li>
          <Link href="/insights">Insights</Link>: earnings previews,
          side-by-side comparisons of two companies, and sector scorecards.
        </li>
        <li>
          <Link href="/scorecards">Scorecards</Link>: every company we have
          analyzed for a quarter, compared sector by sector, and on each
          report, how the company ranks against its industry peers.
        </li>
        <li>
          <Link href="/learn">Guides</Link>: short explanations of terms
          such as operating margin, free cash flow, and how to read a 10-Q,
          written for readers with no finance background.
        </li>
      </ul>

      <h2>Who runs it</h2>
      <p>
        {SITE_NAME} is run by one person, Pham Hop, who enjoys finance and
        reading company results, and wanted a place where anyone can see
        what a company actually reported, in plain English, with the source
        one click away. It is an independent side project, not part of a
        bank, broker, or media company.
      </p>

      <h2>Who writes it</h2>
      <p>
        The analyses are published by the site operator, Pham Hop, who is
        named on each report. Every report is built from the company&apos;s
        own filings and links to the filing it used, so you can check any
        figure against the original. If you spot an error, please use the{" "}
        <Link href="/corrections">corrections page</Link> if you spot an
        error; verified errors are fixed and noted.
      </p>

      <h2>What this is not</h2>
      <p>
        Nothing on this site is investment, tax, or legal advice, and
        nothing here is a recommendation to buy or sell any security. The
        analyses describe what a company reported in a specific period. They
        do not predict share prices and do not consider your circumstances.
        Talk to a licensed professional before making financial decisions.
      </p>

      <h2>Independence</h2>
      <p>
        Companies covered here do not pay for, review, or approve the
        analyses. Coverage is chosen from public listings and by how recent
        the filing is, not by any commercial relationship.
      </p>
    </StaticPage>
  );
}
