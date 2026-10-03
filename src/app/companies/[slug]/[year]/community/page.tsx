import { CompanyYearView, companyYearMetadata } from "../CompanyYearView";

// Community view of the year page; public URL stays
// /companies/<slug>/<year>?source=community (rewritten in next.config.ts).
export const revalidate = 21600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/companies/[slug]/[year]/community">) {
  return companyYearMetadata(await params);
}

export default async function CompanyYearCommunityPage({
  params,
}: PageProps<"/companies/[slug]/[year]/community">) {
  const { slug, year } = await params;
  return <CompanyYearView slug={slug} year={year} source="community" />;
}
