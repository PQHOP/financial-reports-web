import Link from "@/components/Link";
import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";
import { SITE_NAME } from "@/lib/site";

// Cached on the CDN (ISR); publishes purge it via invalidateDbCache().
export const revalidate = 604800;

export const metadata: Metadata = {
  title: "About",
  description:
    "What Financial Report Insights is, how the analyses are produced, and what they are not.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <StaticPage title={`About ${SITE_NAME}`} updated="October 25, 2026">
      <p>
        {SITE_NAME} publishes plain-English analysis of the earnings reports
        that publicly listed companies file with regulators. Each report
        covers what the company earned, what changed compared with the same
        period a year earlier, what management said drove the change, what
        it expects next, and whether the reported figures flatter or
        understate the business.
      </p>

      <h2 id="how-reports-are-made">How each report is made</h2>
      <p>
        Every report starts from the primary document the company filed
        with the SEC (the 10-Q, 10-K or the earnings release attached to
        its 8-K), not from a press summary. The filing is read in full and
        linked at the bottom of the report as &quot;Source filing&quot;, so
        any figure can be checked against the original. Each report then
        works through the same checklist:
      </p>
      <ul>
        <li>
          <strong>What moved and why</strong>, tied to the line item or the
          management sentence that explains it, with the same-period figures
          from a year earlier alongside.
        </li>
        <li>
          <strong>What the headline numbers hide</strong>: cash generated
          versus profit reported; the gap between GAAP and
          &quot;adjusted&quot; figures and exactly what was excluded;
          one-off gains or charges in either year; receivables or inventory
          growing faster than sales; how much of the growth in earnings per
          share came from buybacks, a lower tax rate or lower interest
          rather than from operations; and guidance now versus guidance
          before.
        </li>
        <li>
          <strong>An earnings-quality verdict</strong> (since October 2026):
          <em>Clean</em> when the reported figures match the underlying
          business, <em>Flattered</em> when one-offs, tax, buybacks or
          reserve releases did much of the work, <em>Understated</em> when
          one-off charges or a harsh comparison pulled them down. The
          deciding figure is stated next to the verdict.
        </li>
        <li>
          <strong>Did last time&apos;s read hold up?</strong> When we covered
          the previous period, the report says whether what it told readers
          to watch actually happened.
        </li>
        <li>
          <strong>Management&apos;s guidance</strong>, quoted as the filing
          states it, and set against what the next period delivered on the
          company&apos;s page.
        </li>
      </ul>
      <p>
        Figures are never estimated to fill a gap: if a filing cannot be
        found or read, the company is skipped rather than guessed at.
        Reports are edited when a later filing changes a figure, and the
        &quot;Updated&quot; date on the report says when.
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
