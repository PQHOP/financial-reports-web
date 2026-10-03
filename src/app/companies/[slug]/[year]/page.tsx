import { CompanyYearView, companyYearMetadata } from "./CompanyYearView";

// ISR, purged on publish; ?source=community is rewritten to ./community in
// next.config.ts (see ../page.tsx).
export const revalidate = 21600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/companies/[slug]/[year]">) {
  return companyYearMetadata(await params);
}

export default async function CompanyYearPage({ params }: PageProps<"/companies/[slug]/[year]">) {
  const { slug, year } = await params;
  return <CompanyYearView slug={slug} year={year} source="system" />;
}
