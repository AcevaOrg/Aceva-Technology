import { Fragment, type CSSProperties } from "react";
import { PROCESS_INTRO, PROCESS_PHASES } from "@/lib/data/process";
import ui from "@/components/home/home.module.css";
import styles from "./process.module.css";
import HeroVisual from "./HeroVisual";

/**
 * The headline is the five phase names, each rising out of its own mask in reading order.
 * The jump links are plain in-page anchors to each phase. The visual is decorative.
 */
export default function ProcessHero() {
  return (
    <section className={`${ui.ink} ${styles.hero}`} aria-labelledby="process-title" data-process-hero>
      <div className={`${ui.wrap} ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <p className={`${ui.eyebrow} ${styles.eyebrow}`}>
            <span className={ui.slash} aria-hidden="true" />
            <b>How we work</b> / Five phases
          </p>
          <h1 id="process-title" className={styles.title}>
            {PROCESS_PHASES.map((phase, w) => (
              <Fragment key={phase.key}>
                <span className={styles.word} style={{ "--w": w } as CSSProperties}>
                  <span>
                    {phase.title}
                    <b>.</b>
                  </span>
                </span>{" "}
              </Fragment>
            ))}
          </h1>
          <p className={styles.heroLede}>{PROCESS_INTRO}</p>
          <nav className={styles.jump} aria-label="Phases">
            <ol>
              {PROCESS_PHASES.map((phase) => (
                <li key={phase.key}>
                  <a href={`#${phase.key}`}>
                    <span>{phase.n}</span>
                    {phase.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}
