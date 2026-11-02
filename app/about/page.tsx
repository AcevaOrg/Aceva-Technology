import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/nav";
import ui from "@/components/home/home.module.css";
import HomeMotion from "@/components/home/HomeMotion";
import styles from "@/components/about/about.module.css";
import AboutHero from "@/components/about/AboutHero";
import AboutStance from "@/components/about/AboutStance";
import AboutProof from "@/components/about/AboutProof";
import AboutBuilt from "@/components/about/AboutBuilt";
import AboutClose from "@/components/about/AboutClose";

export const metadata: Metadata = pageMetadata({
  title: "Why ACEVA — How We Position, Sell and Deliver",
  description:
    "We will not compete by saying more — we compete by proving more. How Aceva is positioned, how we sell, and how we deliver software that survives handover.",
  path: ROUTES.about,
  absoluteTitle: true,
});

/**
 * The root is the direct child of main[data-main] and shares the homepage root class, which turns
 * on the sticky-friendly overflow fix and the denser header pill over paper sections.
 */
export default function AboutPage() {
  return (
    <div data-about-root className={`${ui.root} ${styles.page}`}>
      <AboutHero />
      <AboutStance />
      <AboutProof />
      <AboutBuilt />
      <AboutClose />
      <HomeMotion root="[data-about-root]" />
    </div>
  );
}
