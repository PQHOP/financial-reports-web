// Google AdSense, switched on by one env var: ADSENSE_CLIENT, the publisher
// id from the AdSense account ("pub-1234567890123456"; "ca-pub-..." also
// accepted). Unset or malformed = no ad script, no ads.txt, and the CSP in
// next.config.ts stays at its ad-free default. Read at build time (the CSP
// is baked into the config), so changing it needs a redeploy.
const raw = (process.env.ADSENSE_CLIENT ?? "").trim();
const match = raw.match(/^(?:ca-)?(pub-\d{16})$/);

/** "pub-1234567890123456", or null when ads are off. */
export const ADSENSE_PUBLISHER_ID = match ? match[1] : null;

// Hosts AdSense (ads, Auto ads, ad-quality checks and the Privacy & messaging
// consent banner shown to EEA/UK/Swiss visitors) needs. Pages are cached on
// the CDN, so there's no per-request nonce and the loader's own script hosts
// have to be listed. img-src is already `https:`.
export const ADSENSE_CSP = {
  script: [
    "https://*.googlesyndication.com",
    "https://*.doubleclick.net",
    "https://*.google.com",
    "https://*.gstatic.com",
    "https://*.googletagservices.com",
    "https://*.adtrafficquality.google",
    "https://fundingchoicesmessages.google.com",
  ],
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
