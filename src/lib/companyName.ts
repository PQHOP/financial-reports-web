// ~1,250 directory names came from NASDAQ's symbol list with the listed
// security appended ("Stitch Fix, Inc. - Class A", "Rezolute, Inc. - Common
// Stock (NV)", "... - American Depositary Shares"). Public pages show the
// company name without that tail; the stored name is untouched, because the
// admin dropdown (and admin-publish's matching) uses it verbatim.
const SECURITY_SUFFIX =
  /\s+-\s+(?=[^-]*\b(?:Shares?|Stock|ADSs?|ADRs?|Class\s+[A-Z]|Series\s+\w+|Units?|Voting)\b)(?![^-]*\b(?:Fund|Company|Trust)\b)[^-].*$/i;

export function cleanCompanyName(name: string): string {
  const base = name.replace(SECURITY_SUFFIX, "").trim() || name;
  // S&P list style "Coca-Cola Company (The)" -> "The Coca-Cola Company".
  const the = /^(.*\S)\s+\(The\)$/.exec(base);
  return the ? `The ${the[1]}` : base;
}
