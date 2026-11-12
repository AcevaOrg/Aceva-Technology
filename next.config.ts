import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  // Turnstile's challenge compiles WebAssembly, which CSP blocks without an eval
  // permission. 'wasm-unsafe-eval' allows only that, not JavaScript eval().
  `script-src 'self' 'unsafe-inline' ${isDevelopment ? "'unsafe-eval'" : "'wasm-unsafe-eval'"} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  // Turnstile spawns its challenge worker from a blob: URL.
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

// Stored documents are served from /api/documents/<id>/file. The site-wide policy above says
// `object-src 'none'` and `frame-ancestors 'none'`, which stops Chrome and Edge from drawing a PDF
// in their built-in viewer and stops our own verify page from embedding a file. This stricter,
// file-specific policy replaces it for that route only. It must match FILE_RESPONSE_CSP in
// lib/documents/access.ts (a test pins them together); it is repeated here because the config
// is loaded before the "@/" alias exists.
const documentFileContentSecurityPolicy =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'self'; frame-ancestors 'self'";

// The admin console serves the same stored files (preview and download) and its QR images from
// /api/admin/documents/<id>/file and /qr. Those routes set their own headers, but a header the config already
// put on the response wins over the route's, so they need entries of their own for the same reason. A QR is a
// standalone image, which needs nothing beyond inline styling (a script inside an SVG cannot run). Both must
// match ADMIN_FILE_CSP / ADMIN_SVG_CSP in lib/admin/documentsApi.ts (a test pins them together).
const adminQrContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  // Dev-only embedded Postgres (ACEVA_LOCAL_DB=1, see lib/db.ts). Loaded by Node at runtime, never bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      // Listed AFTER the catch-all on purpose: when two entries set the same key, the last wins, and
      // a header the route sets itself is ignored if the config already put one on the response.
      {
        source: "/api/documents/:path*",
        headers: [
          { key: "Content-Security-Policy", value: documentFileContentSecurityPolicy },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // The `code` query value is a credential; the route says no-referrer too, but the config's value would win.
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/api/admin/documents/:id/file",
        headers: [
          { key: "Content-Security-Policy", value: documentFileContentSecurityPolicy },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        source: "/api/admin/documents/:id/qr",
        headers: [{ key: "Content-Security-Policy", value: adminQrContentSecurityPolicy }],
      },
    ];
  },
};

export default nextConfig;
