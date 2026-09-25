// ~1,250 directory names came from NASDAQ's symbol list with the listed
// security appended ("Stitch Fix, Inc. - Class A", "Rezolute, Inc. - Common
// Stock (NV)", "... - American Depositary Shares"). Public pages show the
// company name without that tail; the stored name is untouched, because the
// admin dropdown (and admin-publish's matching) uses it verbatim.
const SECURITY_SUFFIX =
  /\s+-\s+(?=[^-]*\b(?:Shares?|Stock|ADSs?|ADRs?|Class\s+[A-Z]|Series\s+\w+|Units?|Voting)\b)(?![^-]*\b(?:Fund|Company|Trust)\b)[^-].*$/i;

export function cleanCompanyName(name: string): string {
  return name.replace(SECURITY_SUFFIX, "").trim() || name;
}
