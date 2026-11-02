import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/nav";
import ui from "@/components/home/home.module.css";
import HomeMotion from "@/components/home/HomeMotion";
import styles from "@/components/experiments/experiments.module.css";
import ExperimentsHero from "@/components/experiments/ExperimentsHero";
import ExhibitIndex from "@/components/experiments/ExhibitIndex";
import SiteExhibit from "@/components/experiments/SiteExhibit";
import DashboardExhibit from "@/components/experiments/DashboardExhibit";
import MobileExhibit from "@/components/experiments/MobileExhibit";
import AutomationExhibit from "@/components/experiments/AutomationExhibit";
import RescueExhibit from "@/components/experiments/RescueExhibit";
import PulseClose from "@/components/experiments/PulseClose";

export const metadata: Metadata = pageMetadata({
  title: "Experiments — Concept Demos & Internal Products",
  description:
    "Concept demos and internal products, honestly labeled. No client names, no invented metrics — only what we actually built and what it proves.",
  path: ROUTES.work,
  absoluteTitle: true,
});

/**
 * Every experiment is a chapter on one page, server-rendered in full, so all of it is crawlable
 * and deep-linkable (/experiments#rescue-report). The root is the direct child of main[data-main]
 * and shares the homepage root class, which is what turns on the sticky-friendly overflow fix.
 */
export default function ExperimentsPage() {
  return (
    <div data-experiments-root className={`${ui.root} ${styles.page}`}>
      <ExperimentsHero />
      <ExhibitIndex />
      <SiteExhibit />
      <DashboardExhibit />
      <MobileExhibit />
      <AutomationExhibit />
      <RescueExhibit />
      <PulseClose />
      <HomeMotion root="[data-experiments-root]" />
    </div>
  );
}
