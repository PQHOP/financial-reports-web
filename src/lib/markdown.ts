// Small helpers over report Markdown: a table of contents from the section
// headings and the one `> **Takeaway:**` callout every report carries.

// Inline Markdown down to the text a reader sees.
export function plainText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Anchor id for a heading's visible text. ReportContent applies the same
// function to the rendered heading, so TOC links always resolve.
export function headingId(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "section"
  );
}

// Section headings (## and ###) in order, for the report page's contents box.
export function tableOfContents(
  md: string
): { id: string; text: string; level: 2 | 3 }[] {
  const out: { id: string; text: string; level: 2 | 3 }[] = [];
  let inFence = false;
  for (const line of md.split("\n")) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line.replace(/\r$/, ""));
    if (match) {
      const text = plainText(match[2]);
      out.push({ id: headingId(text), text, level: match[1].length as 2 | 3 });
    }
  }
  return out;
}

// The text of the `> **Takeaway:** ...` callout (possibly spanning several
// quoted lines), or null when the report has none.
export function takeaway(md: string): string | null {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => /^>\s*\*\*Takeaway:?\*\*/i.test(l));
  if (start === -1) return null;
  const quoted: string[] = [];
  for (let i = start; i < lines.length && lines[i].startsWith(">"); i++) {
    quoted.push(lines[i].replace(/^>\s?/, ""));
  }
  const text = plainText(quoted.join(" ").replace(/^\*\*Takeaway:?\*\*:?/i, ""));
  return text || null;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}
