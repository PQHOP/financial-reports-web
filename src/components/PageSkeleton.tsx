// Placeholder shown by loading.tsx files while a route renders on the server,
// so a click gives immediate feedback instead of a frozen page.
function Bar({ className }: { className: string }) {
  return <div className={`rounded bg-zinc-200 ${className}`} />;
}

export function PageSkeleton({ variant = "list" }: { variant?: "list" | "article" }) {
  return (
    <div role="status" aria-label="Loading" className="flex animate-pulse flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Bar className="h-4 w-48" />
        <Bar className="h-7 w-3/4" />
        <Bar className="h-4 w-1/2" />
      </div>
      {variant === "article" ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Bar key={i} className="h-20" />
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-6">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Bar key={i} className="h-3" />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4">
              <Bar className="h-4 w-1/3" />
              <Bar className="h-3 w-full" />
              <Bar className="h-3 w-5/6" />
            </div>
          ))}
        </div>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
