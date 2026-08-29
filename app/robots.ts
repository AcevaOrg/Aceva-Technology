import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Only API endpoints are blocked. Pages we want out of the index (/mobile,
      // /insights, /testimonials) are crawlable on purpose: a disallowed page is never
      // fetched, so its `noindex` tag is never read and the URL can still be indexed
      // from an external link.
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
