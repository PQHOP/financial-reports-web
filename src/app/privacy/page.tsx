import Link from "next/link";
import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

// Dynamic on purpose: src/proxy.ts hands out a per-request CSP nonce, and a
// prerendered page has no nonce for Next's inline bootstrap scripts.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What data this site collects, why, and who processes it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy policy" updated="September 20, 2026">
      <p>
        This site is read-only for visitors: there are no accounts, comments,
        or sign-up forms. This page describes the limited data that is
        collected.
      </p>

      <h2>Analytics</h2>
      <p>
        We use Vercel Web Analytics to count page views and see which pages
        and countries readers come from. It does not use cookies to track you
        across sites and does not store your IP address in identifiable form.
      </p>

      <h2>Search</h2>
      <p>
        Text you type into the search box is used to look up companies and is
        not linked to you.
      </p>

      <h2>Hosting and logs</h2>
      <p>
        The site is hosted on Vercel. Like any web host, Vercel processes
        technical request data (such as IP address and browser type) to serve
        pages and protect against abuse.
      </p>

      <h2>Advertising and affiliate links</h2>
      <p>
        The site may show advertising or affiliate links from third parties
        (for example, Google AdSense or brokerage partners). When present,
        these partners may set cookies or use similar technologies to show
        relevant ads and measure them. Affiliate links are disclosed where
        they appear. You can manage ad personalization through{" "}
        <a
          href="https://adssettings.google.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google&apos;s ad settings
        </a>{" "}
        or opt out of interest-based ads at{" "}
        <a
          href="https://www.aboutads.info"
          target="_blank"
          rel="noopener noreferrer"
        >
          aboutads.info
        </a>
        .
      </p>

      <h2>Email and feeds</h2>
      <p>
        If you contact us, we use your email address only to reply. The RSS
        feed at <Link href="/feed.xml">/feed.xml</Link> requires no sign-up.
      </p>

      <h2>Your choices</h2>
      <p>
        You can block cookies in your browser at any time; the site works
        without them. For privacy questions, see the{" "}
        <Link href="/contact">contact page</Link>.
      </p>
    </StaticPage>
  );
}
