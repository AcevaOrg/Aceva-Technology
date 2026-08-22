import type { Metadata } from "next";

export const SITE_NAME = "ACEVA Technology";

type PageMetadataOptions = {
  title: string;
  description: string;
  noIndex?: boolean;
};

/** Keeps search and social metadata aligned while requiring page-specific copy. */
export function pageMetadata({ title, description, noIndex = false }: PageMetadataOptions): Metadata {
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title, description },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
      },
    }),
  };
}
