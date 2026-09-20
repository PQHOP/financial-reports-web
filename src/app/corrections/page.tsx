import Link from "next/link";
import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

// Dynamic on purpose: src/proxy.ts hands out a per-request CSP nonce, and a
// prerendered page has no nonce for Next's inline bootstrap scripts.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Corrections",
  description: "How to report an error in an analysis and how corrections are handled.",
  alternates: { canonical: "/corrections" },
};

export default function CorrectionsPage() {
  return (
    <StaticPage title="Corrections policy" updated="September 20, 2026">
      <p>
        Analyses on this site are written by an AI model from the company&apos;s
        filings, so mistakes can happen. If a figure or a claim in a report
        does not match the filing it links to, we want to know.
      </p>

      <h2>How to report an error</h2>
      <p>
        Use the details on the <Link href="/contact">contact page</Link>. Please
        include the report&apos;s URL, the sentence or figure you believe is
        wrong, and, if you can, the page or section of the filing that shows
        the correct value.
      </p>

      <h2>What happens next</h2>
      <ul>
        <li>
          Each reported error is checked against the primary filing.
        </li>
        <li>
          If it is confirmed, the report is corrected in place and its
          &quot;updated&quot; date changes. Material corrections (ones that
          change the report&apos;s conclusion) are noted in the report text.
        </li>
        <li>
          If the report was right, we will say so and point to the filing
          line.
        </li>
      </ul>

      <h2>What we do not do</h2>
      <p>
        We do not change an analysis because a company or a reader disagrees
        with its conclusions. We correct factual errors: wrong figures, wrong
        periods, and wrong attributions.
      </p>
    </StaticPage>
  );
}
