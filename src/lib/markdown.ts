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

// Splits the "At a glance" bullet list (a `**At a glance**` line or an
// `## At a glance` heading, then a list) out of the report body, so the
// report page can show it right under the headline instead of after the
// figures, charts and opening paragraph. `rest` is the body without it;
// `glance` is null (and `rest` the input) when there is no such list.
export function splitAtAGlance(md: string): { glance: string | null; rest: string } {
  const lines = md.split("\n");
  const start = lines.findIndex((l) =>
    /^(?:#{2,3}\s+|\*\*)At a glance:?(?:\*\*)?:?\s*$/i.test(l.replace(/\r$/, "").trim())
  );
  if (start === -1) return { glance: null, rest: md };
  let i = start + 1;
  while (i < lines.length && lines[i].trim() === "") i++;
  const listStart = i;
  const isItem = (l: string) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(l);
  if (listStart >= lines.length || !isItem(lines[listStart])) return { glance: null, rest: md };
  let end = listStart;
  while (end < lines.length) {
    const l = lines[end];
    if (isItem(l) || (/^\s+\S/.test(l) && end > listStart)) end++;
    else if (l.trim() === "" && end + 1 < lines.length && isItem(lines[end + 1])) end++;
    else break;
  }
  const glance = lines.slice(listStart, end).join("\n").trimEnd();
  const rest = [...lines.slice(0, start), ...lines.slice(end)].join("\n").replace(/\n{3,}/g, "\n\n");
  return { glance, rest };
}
