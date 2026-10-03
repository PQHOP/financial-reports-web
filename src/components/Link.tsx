import NextLink from "next/link";
import type { ComponentProps } from "react";

// next/link with prefetching off by default. When every page was
// force-dynamic, each viewport prefetch of a header/footer link ran a
// serverless function: one page view cost ~25 invocations, and on 2026-10-02 that exhausted the
// Hobby plan's CPU allowance and Vercel disabled the site. Pass
// prefetch={true} explicitly where a link is worth the extra invocation.
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
