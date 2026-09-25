"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/reports", label: "Reports" },
  { href: "/earnings", label: "Earnings" },
  { href: "/economy", label: "Economy" },
  { href: "/rates", label: "Rates" },
  { href: "/insights", label: "Insights" },
  { href: "/learn", label: "Learn" },
];

// Highlights the section you're in; scrolls sideways on narrow screens
// instead of wrapping the header onto a third line.
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-5 whitespace-nowrap text-sm">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block py-1 ${
                  active
                    ? "border-b-2 border-zinc-900 font-medium text-zinc-900"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
