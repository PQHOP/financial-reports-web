import { ADSENSE_PUBLISHER_ID } from "@/lib/adsense";

export const dynamic = "force-dynamic";

// Authorized Digital Sellers file for AdSense; 404 until ADSENSE_CLIENT is set.
// f08c47fec0942fa0 is Google's fixed certification-authority id.
export function GET() {
  if (!ADSENSE_PUBLISHER_ID) return new Response("Not found", { status: 404 });
  return new Response(`google.com, ${ADSENSE_PUBLISHER_ID}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
