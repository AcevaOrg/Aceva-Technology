import { DELIVERED_BY, PROCESS_PHASES } from "@/lib/data/process";
import ui from "@/components/home/home.module.css";
import styles from "./phases.module.css";
import PhaseSpy from "./PhaseSpy";

/**
 * Baseline phases section: the five phases as plain articles. Each design direction replaces
 * this file (and phases.module.css) with its own staging; the article content stays the same.
 */
export default function Phases() {
  return (
    <section id="phases" className={`${ui.paper} ${ui.section}`} aria-labelledby="phases-title">
      <div className={ui.wrap}>
        <p className={ui.eyebrow} data-reveal="up">
          <span className={ui.slash} aria-hidden="true" />
          <b>01</b> Five phases
        </p>
        <h2 id="phases-title" className={`${ui.h2} ${styles.h2}`} data-reveal="up">
          Every phase hands you something in writing.
        </h2>
        <div className={styles.list} data-phases>
          {PROCESS_PHASES.map((phase) => {
            return (
              <article key={phase.key} id={phase.key} className={styles.phase} data-phase data-cum={DELIVERED_BY[phase.key]} aria-labelledby={`${phase.key}-title`}>
                <span className={styles.num} aria-hidden="true">
                  {phase.n}
                </span>
                <div className={styles.body}>
                  <h3 id={`${phase.key}-title`}>{phase.title}</h3>
                  <p>{phase.lead}</p>
                </div>
                <div>
                  <p className={styles.receiveLabel}>You receive</p>
                  <ul className={styles.receive}>
                    {phase.receive.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
        <PhaseSpy />
      </div>
    </section>
  );
}
