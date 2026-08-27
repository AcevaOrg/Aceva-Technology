import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://acevatech.com";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: "ACEVA Technology",
  url: siteUrl,
  logo: `${siteUrl}/favicon.ico`,
  email: "acevatechnology@gmail.com",
  description: "A software engineering company that designs, builds, and scales custom digital products.",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ACEVA Technology — Custom Software, Web & Mobile Engineering",
  description:
    "ACEVA Technology is a premium software engineering company partnering with startups and enterprises to design, build, and scale reliable digital products — custom software, mobile apps, AI & automation, and product rescue.",
  openGraph: {
    title: "ACEVA Technology — Custom Software, Web & Mobile Engineering",
    description:
      "We design, build, and scale reliable digital products — custom software, web & mobile apps, AI & automation, and product rescue.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema).replace(/</g, "\\u003c") }}
        />
        <PulseProvider>
          <div style={{ minHeight: "100vh", background: "#0A0A0C", overflowX: "hidden" }}>
            <AmbientBackground />
            <Header />
            <main data-main style={{ position: "relative", zIndex: 1 }}>
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
