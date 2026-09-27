// Google AdSense, switched on by one env var: ADSENSE_CLIENT, the publisher
// id from the AdSense account ("pub-1234567890123456"; "ca-pub-..." also
// accepted). Unset or malformed = no ad script, no ads.txt, and the CSP in
// src/proxy.ts stays at its strict ad-free default.
const raw = (process.env.ADSENSE_CLIENT ?? "").trim();
const match = raw.match(/^(?:ca-)?(pub-\d{16})$/);

/** "pub-1234567890123456", or null when ads are off. */
export const ADSENSE_PUBLISHER_ID = match ? match[1] : null;

// Hosts AdSense (ads, Auto ads, ad-quality checks and the Privacy & messaging
// consent banner shown to EEA/UK/Swiss visitors) needs beyond script-src,
// which 'strict-dynamic' already covers for scripts the nonce'd loader adds.
// img-src is already `https:`.
export const ADSENSE_CSP = {
  frame: [
    "https://*.googlesyndication.com",
    "https://*.doubleclick.net",
    "https://www.google.com",
    "https://*.adtrafficquality.google",
    "https://fundingchoicesmessages.google.com",
  ],
  connect: [
    "https://*.googlesyndication.com",
    "https://*.doubleclick.net",
    "https://*.google.com",
    "https://*.adtrafficquality.google",
    "https://csi.gstatic.com",
    "https://fundingchoicesmessages.google.com",
  ],
  style: ["https://fonts.googleapis.com"],
  font: ["https://fonts.gstatic.com"],
};
