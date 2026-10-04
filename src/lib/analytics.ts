// Google Analytics 4, switched on by one env var: GA_MEASUREMENT_ID (the web
// stream's "G-XXXXXXXXXX"). Unset or malformed = no gtag script, and the CSP
// in next.config.ts leaves out the GA hosts. Read at build time (the CSP is
// baked into the config), so changing it needs a redeploy.
const raw = (process.env.GA_MEASUREMENT_ID ?? "").trim();

/** "G-XXXXXXXXXX", or null when GA is off. */
export const GA_MEASUREMENT_ID = /^G-[A-Z0-9]{4,16}$/.test(raw) ? raw : null;

// Hosts gtag.js loads from and sends hits to. img-src is already `https:`.
export const GA_CSP = {
  script: ["https://www.googletagmanager.com"],
  connect: [
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.googletagmanager.com",
  ],
};
