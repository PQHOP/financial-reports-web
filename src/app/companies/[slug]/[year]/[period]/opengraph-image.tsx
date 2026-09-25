import { ogSize, reportOgImage } from "@/lib/reportOgImage";
import { findSystemReport } from "@/lib/reportData";

export const alt = "Earnings report analysis";
export const size = ogSize;
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string; year: string; period: string }>;
}) {
  return reportOgImage(await findSystemReport(await params));
}
