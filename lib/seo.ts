import type { Metadata } from "next";
import { X_HANDLE } from "@/lib/social";

export const SITE_NAME = "ACEVA Technology";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://acevatech.com";

/** Appended to every page title by the root layout's title template. */
export const TITLE_SUFFIX = ` — ${SITE_NAME}`;

/**
 * Routes that must never be indexed. The sitemap filters against this set so a page
 * can never be submitted to search engines and marked `noindex` at the same time.
 */
export const NOINDEX_ROUTES = new Set<string>(["/insights", "/testimonials", "/mobile"]);

/**
 * Served by `app/opengraph-image.png` via the file convention. That convention only
 * attaches the image to routes that do not declare their own `openGraph` block, so it is
 * referenced explicitly here — otherwise every page except the homepage ships without one.
 */
const OG_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "ACEVA Technology — custom software, web and mobile engineering",
};

type PageMetadataOptions = {
  /**
   * Distinctive part of the title. The root layout appends `TITLE_SUFFIX`, so pass
   * "Our Technology Stack", not "Our Technology Stack — ACEVA Technology".
   */
  title: string;
  description: string;
  /** Route path, used as the canonical URL — e.g. "/services". */
  path: string;
  noIndex?: boolean;
  /**
   * Set when the title already carries the brand and must bypass the layout template,
   * which would otherwise render "Contact ACEVA … — ACEVA Technology".
   */
  absoluteTitle?: boolean;
  /** Overrides the shared social image with a page-specific 1200x630 card. */
  image?: string;
};

/** Keeps search and social metadata aligned while requiring page-specific copy. */
export function pageMetadata({
  title,
  description,
  path,
  noIndex = false,
  absoluteTitle = false,
  image,
}: PageMetadataOptions): Metadata {
  // Social platforms do not apply the title template, so the brand is resolved here.
  const socialTitle = absoluteTitle ? title : `${title}${TITLE_SUFFIX}`;
  const ogImage = image ? { url: image, width: 1200, height: 630, alt: socialTitle } : OG_IMAGE;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: socialTitle,
      description,
      type: "website",
      siteName: SITE_NAME,
      url: path,
      locale: "en_US",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      site: X_HANDLE,
      creator: X_HANDLE,
      title: socialTitle,
      description,
      images: [ogImage.url],
    },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
      },
    }),
  };
}
