// Cover images from placehold.co are fake-chart placeholders (see CLAUDE.md:
// text only, no placeholder charts). Treat them as "no cover image" so they
// never render on the page or override the generated social card.
export function realCoverImage(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.endsWith("placehold.co") ? null : url;
  } catch {
    return null;
  }
}
