import { ogSize, reportOgImage } from "@/lib/reportOgImage";
import { findSystemReport } from "@/lib/reportData";

export const alt = "Earnings report analysis";
export const size = ogSize;
export const contentType = "image/png";

// Cached like the report page itself (ISR, purged on publish).
export const revalidate = 21600;

export function generateStaticParams() {
  return [];
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string; year: string; period: string }>;
}) {
  return reportOgImage(await findSystemReport(await params));
}
