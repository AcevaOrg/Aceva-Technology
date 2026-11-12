import { describe, expect, it } from "vitest";
import { metadata as verifyCodeMetadata } from "@/app/verify/[code]/page";
import { metadata as verifyMetadata } from "@/app/verify/page";
import { metadata as documentsMetadata } from "@/app/documents/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { ROUTES } from "@/lib/nav";
import { NOINDEX_ROUTES, SITE_URL } from "@/lib/seo";

describe("search-engine visibility of the documents area", () => {
  it("keeps /verify out of the index and out of the sitemap, and /documents in both", async () => {
    expect(NOINDEX_ROUTES.has(ROUTES.verify)).toBe(true);
    expect(NOINDEX_ROUTES.has(ROUTES.documents)).toBe(false);

    const urls = (await Promise.resolve(sitemap())).map((entry) => entry.url);
    expect(urls).toContain(`${SITE_URL}${ROUTES.documents}`);
    expect(urls.some((url) => url.includes("/verify"))).toBe(false);
  });

  it("stops crawlers fetching per-record verification pages and the API, and says nothing else", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.disallow).toEqual(["/api/", "/verify/"]);
    // The public documents hub is crawlable.
    expect(rule.allow).toBe("/");
    expect(JSON.stringify(robots())).not.toMatch(/admin/i);
  });

  it("marks /documents indexable with its own canonical", () => {
    expect(documentsMetadata.robots).toBeUndefined();
    expect(documentsMetadata.alternates?.canonical).toBe(ROUTES.documents);
  });

  it("marks the verify form and every result page noindex, nofollow, noarchive", () => {
    expect(verifyMetadata.robots).toMatchObject({ index: false, follow: false });
    expect(verifyCodeMetadata.robots).toMatchObject({ index: false, follow: false, noarchive: true, nosnippet: true, nocache: true });
  });

  it("gives every result page one title and one canonical, so a link says nothing about the code", () => {
    expect(verifyCodeMetadata.alternates?.canonical).toBe(ROUTES.verify);
    expect(JSON.stringify(verifyCodeMetadata)).not.toMatch(/ACV-/);
  });
});
