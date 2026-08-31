import type { NextConfig } from "next";

// The API/WS origin the browser is allowed to talk to (NEXT_PUBLIC_API_URL is
// the REST base, e.g. https://host/api/v1 — strip the path for the CSP origin).
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").origin;
  } catch {
    return "http://localhost:4000";
  }
})();
const wsOrigin = apiOrigin.replace(/^http/, "ws");
const isDev = process.env.NODE_ENV !== "production";

// A real Content-Security-Policy for the app shell. 'unsafe-inline' stays for
// script/style — the App Router injects inline bootstrap without a nonce
// pipeline — but everything else is locked down: no plugins, no framing, and
// network egress limited to self + the known API/WS origin. This closes the
// injected-script / data-exfil classes that X-Frame-Options alone doesn't.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${wsOrigin}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
