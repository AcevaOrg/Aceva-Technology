import type { CSSProperties } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import { ABOUT_CLOSE } from "@/lib/data/about";
import Scrub from "@/components/home/Scrub";
import ui from "@/components/home/home.module.css";
import styles from "./about.module.css";

export default function AboutClose() {
  return (
    <section className={`${ui.ink} ${styles.close}`}>
      <Scrub start={1} end={0} className={styles.closeScrub}>
        <span className={styles.closeSlash} aria-hidden="true" />
        <div className={styles.wrap}>
          <blockquote>
            {ABOUT_CLOSE.lines.map((line, i) => (
              <span key={line} className={styles.qline} data-reveal="wipe" style={{ "--d": `${i * 160}ms` } as CSSProperties}>
                {line}{" "}
              </span>
            ))}
          </blockquote>
          <div className={styles.cta} data-reveal="up" style={{ "--d": "520ms" } as CSSProperties}>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href={ROUTES.contact}>
              Start a Project
            </Link>
            <Link className={`${styles.btn} ${styles.btnGhost}`} href={ROUTES.company}>
              About the company
            </Link>
          </div>
        </div>
      </Scrub>
    </section>
  );
}
