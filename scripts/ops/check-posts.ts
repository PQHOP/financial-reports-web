// Length check for the daily copy-paste posts file (ops/posts/<date>.md, see
// CLAUDE.md "Daily operations routine"). Counts each X block the way X does
// (any URL is 23; characters outside X's single-weight ranges — arrows, ≈,
// emoji, CJK… — count 2) against 260, leaving room under X's 280 for a word
// the user adds. On 2026-10-26 four of five X drafts were 285–408 and X
// refused them, so the routine runs this before committing the file.
//
//   npm run check-posts -- ops/posts/2026-10-26.md
//
// Exits 1 and lists every X block over the limit.
import { readFileSync } from "node:fs";

const LIMIT = 260;
const URL_WEIGHT = 23;
// twitter-text v3 default config: code points in these ranges weigh 1, the
// rest weigh 2.
const LIGHT: Array<[number, number]> = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];

function weightedLength(text: string): number {
  let n = 0;
  const rest = text.replace(/https?:\/\/\S+/g, () => {
    n += URL_WEIGHT;
    return "";
  });
  for (const ch of rest) {
    const c = ch.codePointAt(0)!;
    n += LIGHT.some(([lo, hi]) => c >= lo && c <= hi) ? 1 : 2;
  }
  return n;
}

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run check-posts -- ops/posts/<date>.md");
  process.exit(2);
}

const md = readFileSync(file, "utf8").replace(/\r/g, "");
const block = /^### (.*)\n+```text\n([\s\S]*?)\n```/gm;
let failed = 0;
let checked = 0;
for (const [, label, body] of md.matchAll(block)) {
  if (!/·\s*X\s*·/.test(label)) continue;
  checked++;
  const n = weightedLength(body);
  const ok = n <= LIMIT;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "OVER"} ${String(n).padStart(3)}/${LIMIT}  ${label}`);
}
if (checked === 0) console.log("no X blocks found (label lines need '· X ·')");
process.exit(failed ? 1 : 0);
