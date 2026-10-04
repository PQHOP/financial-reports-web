import { GA_MEASUREMENT_ID } from "@/lib/analytics";

// The GA4 gtag loader plus its config call. Plain tags (no next/script) so the
// cached ISR HTML carries them; the CSP allows 'unsafe-inline' scripts and the
// GA hosts (GA_CSP) once GA_MEASUREMENT_ID is set.
export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;
  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`,
        }}
      />
    </>
  );
}
