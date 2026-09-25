import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/site";

export type Crumb = { name: string; href: string };

// The visible trail and its BreadcrumbList JSON-LD come from the same list, so
// what Google shows under the result always matches the page. The last crumb
// is the current page and isn't linked.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail = [{ name: "Home", href: "/" }, ...items];
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((crumb, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: crumb.name,
            item: `${SITE_URL}${crumb.href === "/" ? "" : crumb.href}`,
          })),
        }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
        <ol className="flex flex-wrap items-center gap-x-1.5">
          {trail.map((crumb, i) => (
            <li key={crumb.href} className="flex items-center gap-x-1.5">
              {i > 0 && <span aria-hidden>›</span>}
              {i === trail.length - 1 ? (
                <span aria-current="page" className="text-zinc-700">
                  {crumb.name}
                </span>
              ) : (
                <Link href={crumb.href} className="hover:underline">
                  {crumb.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
