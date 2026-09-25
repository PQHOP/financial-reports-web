import Link from "next/link";
import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

// Dynamic on purpose: src/proxy.ts hands out a per-request CSP nonce, and a
// prerendered page has no nonce for Next's inline bootstrap scripts.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How each earnings analysis is produced: primary SEC filings, direct reading of the document, structured figures, and known limits.",
  alternates: { canonical: "/methodology" },
};

export default function MethodologyPage() {
  return (
    <StaticPage title="Methodology" updated="September 20, 2026">
      <p>
        This page explains how a report on this site goes from a company&apos;s
        filing to a published analysis, and where the process can fail.
      </p>

      <h2>1. Source: the company&apos;s own filing</h2>
      <p>
        Analyses are built from primary documents: the quarterly report
        (Form 10-Q), the annual report (Form 10-K), or the earnings release
        the company files with the U.S. Securities and Exchange Commission
        (SEC) through its EDGAR database. We do not rely on news summaries
        or third-party data feeds for the figures. Each published report
        links to the filing it used.
      </p>

      <h2>2. The filing is read directly</h2>
      <p>
        The filing is downloaded and converted to plain text, then searched
        and read section by section: the financial statements, the
        management discussion (MD&amp;A) where the company explains why
        numbers moved, segment and regional detail, and the outlook. Figures
        in the report are taken from those sections, including year-to-date
        figures alongside the quarter.
      </p>

      <h2>3. What every report contains</h2>
      <ul>
        <li>A headline stating what happened and what drove it.</li>
        <li>
          A metrics table comparing the period with the same period a year
          earlier: revenue, margin, net income, earnings per share, and one
          or two measures specific to the industry. Banks are also compared
          on net interest margin, efficiency ratio, net charge-offs and CET1
          capital; insurers on premiums written, combined ratio and book
          value per share.
        </li>
        <li>
          Explanations tied to a specific line item or a sentence in the
          filing, with one-off items, currency effects, and mix changes
          called out when the filing supports that reading.
        </li>
        <li>
          A single takeaway, plus management&apos;s guidance where given and
          our reading of the trajectory.
        </li>
      </ul>

      <h2>4. Plain language</h2>
      <p>
        Terms are explained the first time they matter to a sentence, and
        the <Link href="/learn">guides</Link> cover the recurring ones. We
        keep the specific numbers and causes; we drop the jargon around them.
      </p>

      <h2>5. Adjusted versus reported figures</h2>
      <p>
        Where a company reports both GAAP (the standard accounting rules)
        and &quot;adjusted&quot; or &quot;non-GAAP&quot; figures, reports say
        which one a number is. When the two point in different directions,
        the report says so.
      </p>

      <h2>6. Known limits</h2>
      <ul>
        <li>
          The analyses are written by an AI model (Claude). It can misread a
          table, pick the wrong line item, or miss context that is not in the
          filing. The source link on every report is there so you can check.
        </li>
        <li>
          Reports describe what was filed on a given date. Later events,
          restatements, or amended filings may change the picture; when we
          learn of one, the report is updated.
        </li>
        <li>
          Reports do not value a company, forecast its share price, or say
          whether to buy or sell it.
        </li>
      </ul>

      <h2>7. Errors and updates</h2>
      <p>
        Verified errors are corrected in place and the report&apos;s
        &quot;updated&quot; date changes. See the{" "}
        <Link href="/corrections">corrections policy</Link> to report one.
      </p>
    </StaticPage>
  );
}
