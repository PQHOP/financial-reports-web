import { CompanyView, companyMetadata } from "./CompanyView";

// Served from the CDN cache (ISR); every publish purges it via
// invalidateDbCache(), so the timer only refreshes date-based bits like the
// next expected filing. ?source=community is rewritten to ./community in
// next.config.ts, so this page never reads the query string.
export const revalidate = 21600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/companies/[slug]">) {
  return companyMetadata(await params);
}

export default async function CompanyPage({ params }: PageProps<"/companies/[slug]">) {
  const { slug } = await params;
  return <CompanyView slug={slug} source="system" />;
}
