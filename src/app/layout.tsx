import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SITE_NAME, SITE_URL } from "@/lib/site";
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
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Financial Report Insights
            </Link>
            <nav className="flex gap-4 text-sm text-zinc-600">
              <Link href="/reports" className="hover:text-zinc-900">
                Reports
              </Link>
              <Link href="/earnings" className="hover:text-zinc-900">
                Earnings
              </Link>
              <Link href="/economy" className="hover:text-zinc-900">
                Economy
              </Link>
              <Link href="/insights" className="hover:text-zinc-900">
                Insights
              </Link>
              <Link href="/learn" className="hover:text-zinc-900">
                Learn
              </Link>
            </nav>
            <form action="/search" method="GET" className="flex-1 max-w-xs">
              <input
                type="search"
                name="q"
                placeholder="Search company name or ticker..."
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
              />
            </form>
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
