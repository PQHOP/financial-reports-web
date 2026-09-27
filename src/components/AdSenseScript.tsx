import { headers } from "next/headers";
import { ADSENSE_PUBLISHER_ID } from "@/lib/adsense";

// The AdSense loader tag (site verification + Auto ads + consent banner).
// React hoists an async <script src> into <head>; the nonce is what lets it
// run under the CSP from src/proxy.ts.
export async function AdSenseScript() {
  if (!ADSENSE_PUBLISHER_ID) return null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${ADSENSE_PUBLISHER_ID}`}
      crossOrigin="anonymous"
      nonce={nonce}
    />
  );
}
