import { headers } from "next/headers";

// One place for the hand-authored JSON-LD <script>: reads the per-request CSP
// nonce that src/proxy.ts sets, and escapes "<" so content can't close the tag.
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
