import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import HomeHero from "@/components/home/HomeHero";
import PathsSection from "@/components/home/PathsSection";
import CapabilitiesSection from "@/components/home/CapabilitiesSection";
import RescueSpotlight from "@/components/home/RescueSpotlight";
import HowWeWork from "@/components/home/HowWeWork";
import ProofSection from "@/components/home/ProofSection";
import DemoReviews from "@/components/home/DemoReviews";
import FinalCta from "@/components/home/FinalCta";
import HomeMotion from "@/components/home/HomeMotion";
import ui from "@/components/home/home.module.css";

// Static homepage metadata is exported from this Server Component.
// The brand already leads this title, so it bypasses the layout's "%s — ACEVA Technology" template.
export const metadata: Metadata = pageMetadata({
  title: "ACEVA Technology — Custom Software, Web & Mobile Engineering",
  description:
    "ACEVA Technology designs, builds and scales custom software, web and mobile products. AI-accelerated, senior-reviewed, production-ready.",
  path: "/",
  absoluteTitle: true,
});

export default function HomePage() {
  return (
    <div data-home-root className={ui.root}>
      <HomeHero />
      <PathsSection />
      <CapabilitiesSection />
      <RescueSpotlight />
      <HowWeWork />
      <ProofSection />
      <DemoReviews />
      <FinalCta />
      <HomeMotion />
    </div>
  );
}
