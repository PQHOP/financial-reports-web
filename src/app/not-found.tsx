import Link from "next/link";
import Form from "next/form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex flex-col gap-4 py-8">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-zinc-600">
        That page doesn&apos;t exist or has moved. Search for the company you
        were looking for:
      </p>
      <Form action="/search" role="search" className="max-w-sm">
        <input
          type="search"
          name="q"
          aria-label="Search companies"
          placeholder="Company or ticker…"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
      </Form>
      <p className="text-sm text-zinc-600">
        Or browse the <Link href="/reports" className="underline">latest reports</Link>{" "}
        and the <Link href="/earnings" className="underline">earnings calendar</Link>.
      </p>
    </div>
  );
}
