import Link from "next/link";
import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the site operator about errors, press, or privacy questions.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  // Set CONTACT_EMAIL in the Vercel project env (ideally an address at the
  // site's own domain). Until then the page says so plainly instead of
  // publishing a personal address.
  const email = process.env.CONTACT_EMAIL?.trim();

  return (
    <StaticPage title="Contact" updated="September 20, 2026">
      {email ? (
        <p>
          Email <a href={`mailto:${email}`}>{email}</a> for corrections, press
          inquiries, or privacy questions.
        </p>
      ) : (
        <p>
          A public contact address is being set up. In the meantime, find the
          report you have a question about and use the source link on it to
          check the original filing.
        </p>
      )}
      <p>
        To report an error in an analysis, include the report&apos;s URL and
        the figure or sentence in question; see the{" "}
        <Link href="/corrections">corrections policy</Link> for what happens
        next.
      </p>
    </StaticPage>
  );
}
