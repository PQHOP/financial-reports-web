import type { ReactNode } from "react";

export function StaticPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {updated && <p className="mt-1 text-sm text-zinc-500">Last updated {updated}</p>}
      <div className="prose prose-zinc mt-4 max-w-none prose-h2:mt-8 prose-h2:text-lg">
        {children}
      </div>
    </article>
  );
}
