import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework to scanners/attackers.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Baseline hardening on every response. No Content-Security-Policy
        // yet — Next.js App Router's RSC streaming relies on inline
        // bootstrap scripts, so a CSP here needs a nonce wired through
        // proxy.ts to avoid breaking hydration; that's a separate,
        // more carefully tested change.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
