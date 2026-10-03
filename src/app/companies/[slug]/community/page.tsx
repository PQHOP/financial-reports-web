import { CompanyView, companyMetadata } from "../CompanyView";

// The community view of the company page. Public URL stays
// /companies/<slug>?source=community (rewritten here in next.config.ts);
// canonical points at the system view.
export const revalidate = 21600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/companies/[slug]/community">) {
  return companyMetadata(await params);
}

export default async function CompanyCommunityPage({ params }: PageProps<"/companies/[slug]/community">) {
  const { slug } = await params;
  return <CompanyView slug={slug} source="community" />;
}
