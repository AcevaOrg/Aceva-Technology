import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/nav";
import ui from "@/components/home/home.module.css";
import HomeMotion from "@/components/home/HomeMotion";
import styles from "@/components/process/process.module.css";
import ProcessHero from "@/components/process/ProcessHero";
import Phases from "@/components/process/Phases";
import WeeklyUpdate from "@/components/process/WeeklyUpdate";
import OwnershipLedger from "@/components/process/OwnershipLedger";
import Rules from "@/components/process/Rules";
import ProcessFaq from "@/components/process/ProcessFaq";
import ProcessClose from "@/components/process/ProcessClose";

export const metadata: Metadata = pageMetadata({
  title: "Our Development Process",
  description:
    "Five phases with weekly demos and clear ownership: understand, design, build, launch, improve. Written milestones and acceptance criteria on every engagement.",
  path: ROUTES.process,
});

/**
 * The whole process on one server-rendered page, deep-linkable by phase (/process#build).
 * The root is the direct child of main[data-main] and shares the homepage root class, which
 * turns on the sticky-friendly overflow fix and the darker header pill over paper sections.
 */
export default function ProcessPage() {
  return (
    <div data-process-root className={`${ui.root} ${styles.page}`}>
      <ProcessHero />
      <Phases />
      <WeeklyUpdate />
      <OwnershipLedger />
      <Rules />
      <ProcessFaq />
      <ProcessClose />
      <HomeMotion root="[data-process-root]" />
    </div>
  );
}
