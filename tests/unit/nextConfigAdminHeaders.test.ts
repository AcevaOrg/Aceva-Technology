import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { ADMIN_FILE_CSP, ADMIN_SVG_CSP } from "@/lib/admin/documentsApi";

/**
 * Next puts the config's headers on a response first and then only adds a route's own header when the
 * response does not already carry it, so a route cannot loosen the site-wide policy by itself. The admin file
 * and QR routes therefore need their own config entries, listed after the catch-all (the last match wins).
 */

type HeaderEntry = { source: string; headers: Array<{ key: string; value: string }> };

async function entries(): Promise<HeaderEntry[]> {
  return ((await nextConfig.headers?.()) ?? []) as HeaderEntry[];
}

function valueOf(entry: HeaderEntry | undefined, key: string): string | undefined {
  return entry?.headers.find((header) => header.key === key)?.value;
}

describe("next.config.ts headers for the admin file and QR routes", () => {
  it("applies the same file CSP and frame policy to the admin file route as the route sets itself", async () => {
    const all = await entries();
    const catchAll = all.findIndex((entry) => entry.source === "/:path*");
    const index = all.findIndex((entry) => entry.source === "/api/admin/documents/:id/file");
    expect(catchAll).toBeGreaterThanOrEqual(0);
    expect(index).toBeGreaterThan(catchAll);
    expect(valueOf(all[index], "Content-Security-Policy")).toBe(ADMIN_FILE_CSP);
    expect(valueOf(all[index], "X-Frame-Options")).toBe("SAMEORIGIN");
    // A PDF can only be drawn by the browser's viewer when the policy lets the page embed an object.
    expect(ADMIN_FILE_CSP).toContain("object-src 'self'");
  });

  it("applies the standalone-image CSP to the admin QR route", async () => {
    const all = await entries();
    const catchAll = all.findIndex((entry) => entry.source === "/:path*");
    const index = all.findIndex((entry) => entry.source === "/api/admin/documents/:id/qr");
    expect(index).toBeGreaterThan(catchAll);
    expect(valueOf(all[index], "Content-Security-Policy")).toBe(ADMIN_SVG_CSP);
  });

  it("keeps the strict site-wide policy for every other admin API route", async () => {
    const all = await entries();
    const sources = all.map((entry) => entry.source);
    expect(sources).not.toContain("/api/admin/:path*");
    expect(sources).not.toContain("/api/admin/documents/:path*");
  });

  it("keeps the code out of Referer for public document files", async () => {
    const all = await entries();
    const publicFiles = all.find((entry) => entry.source === "/api/documents/:path*");
    expect(valueOf(publicFiles, "Referrer-Policy")).toBe("no-referrer");
  });
});
