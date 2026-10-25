import type { Metadata } from "next";
import Link from "@/components/Link";
import { StaticPage } from "@/components/StaticPage";
import { ALL_TICKERS, confirmSubscription } from "@/lib/alerts";

// Rendered per request (it reads the token and writes the confirmation);
// never cached, never indexed.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm email alert",
  robots: { index: false, follow: false },
};

export default async function ConfirmAlertPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const result = await confirmSubscription(typeof token === "string" ? token : undefined);

  return (
    <StaticPage title={result ? "Alert confirmed" : "Link not valid"}>
      {result ? (
        <p>
          You&apos;ll get one email each time we publish a new analysis of{" "}
          {result.ticker === ALL_TICKERS ? "any company" : result.ticker}. Every
          email has a one-click unsubscribe link.
        </p>
      ) : (
        <p>
          This confirmation link is not valid, or the alert was already
          removed. You can sign up again from the company&apos;s page.
        </p>
      )}
      <p>
        <Link href="/">Back to the home page</Link>
      </p>
    </StaticPage>
  );
}
