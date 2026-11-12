import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // API endpoints and the per-record verification pages are blocked. Pages we want out
      // of the index (/mobile, /insights, /testimonials, the /verify form) are crawlable on
      // purpose: a disallowed page is never fetched, so its `noindex` tag is never read and
      // the URL can still be indexed from an external link. /verify/<code> is the exception
      // because every visit there is a logged lookup against a record, so crawlers must not
      // generate them; those pages are also marked noindex and carry unguessable codes.
      disallow: ["/api/", "/verify/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
