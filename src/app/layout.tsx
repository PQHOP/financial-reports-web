import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Form from "next/form";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { NavigationProgress } from "@/components/NavigationProgress";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DEFAULT_DESCRIPTION =
  "In-depth financial report analysis for publicly listed companies worldwide, organized by industry, company, and reporting period.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
  },
  alternates: {
    types: { "application/rss+xml": "/feed.xml" },
  },
  // No site-wide `robots` here: indexing is the default, and a layout-level
  // "index, follow" was emitted next to the not-found page's "noindex".
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <header className="border-b border-zinc-200 bg-white">
          {/* Mobile: logo + search on one row, the menu scrolls sideways
              below. From sm up: logo, menu, search in one row. */}
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:py-4">
            <Link href="/" className="shrink-0 text-base font-semibold tracking-tight sm:text-lg">
              Financial Report Insights
            </Link>
            <div className="order-3 w-full sm:order-2 sm:w-auto">
              <SiteNav />
            </div>
            {/* Client-side navigation (no full reload) via next/form. No
                submit button: scripts/admin-publish.ts clicks the page's
                only button[type=submit]. */}
            <Form action="/search" role="search" className="order-2 min-w-0 flex-1 sm:order-3 sm:ml-auto sm:max-w-xs">
              <input
                type="search"
                name="q"
                aria-label="Search companies"
                placeholder="Company or ticker…"
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
              />
            </Form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-zinc-200 py-6">
          <nav className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-5 gap-y-2 px-4 text-xs text-zinc-500">
            <Link href="/about" className="hover:underline">About</Link>
            <Link href="/methodology" className="hover:underline">Methodology</Link>
            <Link href="/corrections" className="hover:underline">Corrections</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/contact" className="hover:underline">Contact</Link>
            <a href="/feed.xml" className="hover:underline">RSS</a>
          </nav>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
