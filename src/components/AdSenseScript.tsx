import { ADSENSE_PUBLISHER_ID } from "@/lib/adsense";

// The AdSense loader tag (site verification + Auto ads + consent banner).
// React hoists an async <script src> into <head>; the CSP in next.config.ts
// allows its hosts (ADSENSE_CSP.script) once ads are switched on.
export function AdSenseScript() {
  if (!ADSENSE_PUBLISHER_ID) return null;
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${ADSENSE_PUBLISHER_ID}`}
      crossOrigin="anonymous"
    />
  );
}
