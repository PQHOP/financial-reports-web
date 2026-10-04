import Link from "@/components/Link";
import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";
import { SITE_NAME } from "@/lib/site";

// Cached on the CDN (ISR); publishes purge it via invalidateDbCache().
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using this site, submitting a community report, and reusing its content.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <StaticPage title="Terms of use" updated="October 5, 2026">
      <p>
        By using {SITE_NAME}, you agree to these terms. If you do not agree,
        please do not use the site.
      </p>

      <h2>Not investment advice</h2>
      <p>
        Everything on this site is commentary on information companies have
        already made public, not investment, tax, or legal advice, and not a
        recommendation to buy, sell, or hold any security. See the{" "}
        <Link href="/about">About page</Link> for what the analyses are and
        are not. You are responsible for your own financial decisions and
        should consult a licensed professional before making them.
      </p>

      <h2>Accuracy</h2>
      <p>
        Analyses are built from each company&apos;s own public filings, which
        every report links to so you can check a figure against the source.
        Mistakes can still happen. If you find one, use the{" "}
        <Link href="/corrections">corrections page</Link>; we do not warrant
        that any figure, date, or statement on the site is complete or free
        of error.
      </p>

      <h2>Using the content</h2>
      <p>
        You may read, link to, and quote short excerpts of this site&apos;s
        analyses with attribution and a link back to the original page.
        Republishing a report in full, scraping the site to republish its
        content elsewhere, or presenting it as your own work is not
        permitted without asking first &mdash; see the{" "}
        <Link href="/contact">contact page</Link>. The underlying financial
        figures themselves come from each company&apos;s public filings and
        are not owned by anyone.
      </p>

      <h2>Community reports</h2>
      <p>
        Anyone can submit their own written report for a company. By
        submitting one, you confirm it is your own work, you have the right
        to share it, and you grant {SITE_NAME} a non-exclusive,
        royalty-free license to publish, display, and keep it on the site.
        Submissions must not be spam, impersonate someone else, infringe
        anyone&apos;s rights, or contain unlawful content; we may reject or
        remove a submission for any reason, including before it is published.
        See the <Link href="/privacy">privacy policy</Link> for how a
        submission&apos;s data is handled.
      </p>

      <h2>Third-party links and advertising</h2>
      <p>
        Pages may link to source filings, other websites, or show advertising
        from third parties such as Google AdSense. We do not control and are
        not responsible for the content, accuracy, or practices of sites we
        link to, and a link is not an endorsement.
      </p>

      <h2>No warranty, limited liability</h2>
      <p>
        The site is provided &ldquo;as is,&rdquo; without warranties of any
        kind. To the extent allowed by law, {SITE_NAME} and its operator are
        not liable for any loss or damage arising from your use of the site
        or reliance on anything published on it.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may be updated as the site changes; the date at the top
        of this page reflects the latest revision. Continuing to use the
        site after a change means you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms go to the{" "}
        <Link href="/contact">contact page</Link>.
      </p>
    </StaticPage>
  );
}
