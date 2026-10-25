import type { Metadata } from "next";
import Link from "@/components/Link";
import { StaticPage } from "@/components/StaticPage";
import { ALL_TICKERS, unsubscribe } from "@/lib/alerts";

// Rendered per request (it reads the token and deletes the alert); never
// cached, never indexed.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const result = await unsubscribe(typeof token === "string" ? token : undefined);

  return (
    <StaticPage title="Unsubscribed">
      {result ? (
        <p>
          Done: you won&apos;t get any more emails about{" "}
          {result.ticker === ALL_TICKERS ? "new reports" : result.ticker}.
        </p>
      ) : (
        <p>This alert was already removed, so there is nothing more to do.</p>
      )}
      <p>
        <Link href="/">Back to the home page</Link>
      </p>
    </StaticPage>
  );
}
