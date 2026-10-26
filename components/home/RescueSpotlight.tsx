import type { CSSProperties } from "react";
import Link from "next/link";
import { ROUTES, contactRoute } from "@/lib/nav";
import { ArrowRightIcon } from "@/components/ui/icons";
import { RESCUE } from "./content";
import ui from "./home.module.css";
import styles from "./rescue.module.css";

const VERDICT_CLASS: Record<string, string> = {
  Keep: styles.keep,
  Remediate: styles.remediate,
  Replace: styles.replace,
};

export default function RescueSpotlight() {
  return (
    <section id="rescue" className={`${ui.ink} ${ui.section} ${styles.rescue}`} aria-labelledby="rescue-title">
      <span className={styles.slab} aria-hidden="true" />
      <div className={ui.wrap}>
        <div className={styles.grid}>
          <div className={styles.copy}>
            <div data-reveal="up">
              <p className={ui.eyebrow}>
                <span className={ui.slash} aria-hidden="true" />
                <b>03</b> Flagship · Product Rescue &amp; Reliability
              </p>
              <h2 id="rescue-title" className={ui.h2}>
                The offer most agencies avoid.
              </h2>
              <p className={`${ui.lede} ${styles.lede}`}>{RESCUE.sales}</p>
            </div>

            <div className={styles.sprint} data-reveal="up" style={{ "--d": "80ms" } as CSSProperties}>
              <p className={styles.sprintTitle}>{RESCUE.sprintTitle} — the first engagement</p>
              <ol className={styles.steps}>
                {RESCUE.sprintSteps.map((step, n) => (
                  <li key={step}>
                    <span className={styles.stepNum}>{String(n + 1).padStart(2, "0")}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className={ui.actions} data-reveal="up" style={{ "--d": "140ms" } as CSSProperties}>
              <Link href={contactRoute("help")} className={`${ui.btn} ${ui.btnPrimary}`}>
                Request a Rescue Sprint
                <ArrowRightIcon width={16} height={16} strokeWidth={2.2} />
              </Link>
              <Link href={ROUTES.work} className={`${ui.btn} ${ui.btnGhost}`}>
                See the full sample report
              </Link>
            </div>
          </div>

          <figure className={styles.report} data-reveal="wipe" aria-labelledby="rescue-report-title">
            <div className={styles.bar}>
              <span className={styles.dots} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className={styles.file}>rescue-report / kestrel</span>
              <span className={`${ui.label} ${styles.sample}`}>Sample deliverable · fictional project</span>
            </div>

            <div className={styles.reportHead}>
              <p className={styles.reportKicker}>Rescue Report</p>
              <p id="rescue-report-title" className={styles.reportTitle}>
                Kestrel Booking (fictional)
              </p>
            </div>

            <ul className={styles.rows}>
              {RESCUE.reportRows.map((row, n) => (
                <li key={row.area} className={styles.row} style={{ "--i": n } as CSSProperties}>
                  <span className={styles.area}>
                    {row.area}
                    <span className={styles.severity}>{row.severity}</span>
                  </span>
                  <span className={styles.finding}>{row.finding}</span>
                  <span className={`${styles.verdict} ${VERDICT_CLASS[row.verdict]}`}>{row.verdict}</span>
                </li>
              ))}
            </ul>

            <ol className={styles.roadmap}>
              {RESCUE.roadmap.map((phase, n) => (
                <li key={phase.when} style={{ "--i": n } as CSSProperties}>
                  <span className={styles.when}>{phase.when}</span>
                  <span className={styles.phase}>{phase.body}</span>
                </li>
              ))}
            </ol>
          </figure>
        </div>
      </div>
    </section>
  );
}
