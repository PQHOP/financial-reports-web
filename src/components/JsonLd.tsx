// One place for the hand-authored JSON-LD <script>. It's a data block, not
// executable script, so the CSP doesn't apply to it; "<" is escaped so
// content can't close the tag.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\u003c"),
      }}
    />
  );
}
