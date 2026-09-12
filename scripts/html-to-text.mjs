/**
 * SEC filings (10-Q/10-K/8-K exhibits) are inline-XBRL HTML, usually shipped
 * as one giant minified line — unreadable via Grep/Read directly. This
 * converts a downloaded filing to line-per-element plain text so financial
 * statement sections can be located and read normally.
 *
 * Usage: node scripts/html-to-text.mjs <input.htm> <output.txt>
 */
import fs from "fs";
const inPath = process.argv[2];
const outPath = process.argv[3];

let html = fs.readFileSync(inPath, "utf8");
html = html.replace(/<\/(p|div|tr|td|th|table|li)>/gi, "$&\n");
html = html.replace(/<br\s*\/?>/gi, "\n");
let text = html.replace(/<[^>]+>/g, " ");
text = text
  .replace(/&nbsp;/g, " ")
  .replace(/&#160;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&#8217;/g, "'");
text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
fs.writeFileSync(outPath, text);
console.log("lines:", text.split("\n").length, "chars:", text.length);
