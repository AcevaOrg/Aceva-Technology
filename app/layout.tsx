import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_URL, TITLE_SUFFIX } from "@/lib/seo";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MobileCtaBar from "@/components/layout/MobileCtaBar";
import AmbientBackground from "@/components/layout/AmbientBackground";
import BackToTopButton from "@/components/layout/BackToTopButton";
import { PulseProvider, PulseOverlay } from "@/components/pulse";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  fallback: ["sans-serif"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  fallback: ["system-ui", "sans-serif"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  fallback: ["monospace"],
});

const siteUrl = SITE_URL;

/**
 * Public profiles for this company. Google uses `sameAs` to confirm that these accounts
 * and this website are the same entity, which is the main input to a brand knowledge
 * panel. Add the LinkedIn company page and GitHub organisation URLs here.
 */
const SOCIAL_PROFILES: string[] = [
  // Public company page. Do NOT use the /admin/dashboard/ URL — that is the private
  // management view, it is not crawlable, and Google cannot verify it as this entity.
  "https://www.linkedin.com/company/143570032/",
  "https://www.instagram.com/acevatechnology",
  "https://www.facebook.com/share/1DJXzSK13W/",
];

const ORG_DESCRIPTION =
  "A software engineering company that designs, builds, and scales custom digital products.";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: SITE_NAME,
      url: siteUrl,
      // Must be a crawlable raster image of at least 112x112. An .ico is not a supported
      // format here, so the logo would silently never appear in Google's company panel.
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/icon-512.png`,
        width: 512,
        height: 512,
      },
      image: `${siteUrl}/opengraph-image.png`,
      email: "acevatech.official@gmail.com",
      description: ORG_DESCRIPTION,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "acevatech.official@gmail.com",
        url: `${siteUrl}/contact`,
        availableLanguage: ["English"],
      },
      ...(SOCIAL_PROFILES.length > 0 && { sameAs: SOCIAL_PROFILES }),
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: SITE_NAME,
      description: ORG_DESCRIPTION,
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en-US",
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    // Used by any route that does not set its own title.
    default: `${SITE_NAME} — Custom Software, Web & Mobile Engineering`,
    // Pages supply only the distinctive part; the brand is appended here.
    template: `%s${TITLE_SUFFIX}`,
  },
  description:
    "ACEVA Technology designs, builds and scales custom software, web and mobile products. AI-accelerated, senior-reviewed, production-ready.",
  openGraph: {
    title: `${SITE_NAME} — Custom Software, Web & Mobile Engineering`,
    description:
      "ACEVA Technology designs, builds and scales custom software, web and mobile products. AI-accelerated, senior-reviewed, production-ready.",
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
  },
  // Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION to the token Search Console gives you and
  // the verification tag is emitted automatically. Omitted entirely when unset.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && {
    verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  }),
};

export const viewport = {
  themeColor: "#0A0A0C",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${spaceGrotesk.variable} ${instrumentSans.variable} ${jetBrainsMono.variable}`}>
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
        <a href="#main-content" className="ac-skip-link">
          Skip to content
        </a>
        <PulseProvider>
          <div style={{ minHeight: "100vh", background: "#0A0A0C", overflowX: "hidden" }}>
            <AmbientBackground />
            <Header />
            <main id="main-content" tabIndex={-1} data-main style={{ position: "relative", zIndex: 1 }}>
              {children}
            </main>
            <Footer />
            <BackToTopButton />
            <MobileCtaBar />
            <PulseOverlay />
          </div>
        </PulseProvider>
      </body>
    </html>
  );
}
