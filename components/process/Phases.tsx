import type { CSSProperties } from "react";
import { DELIVERABLES, DELIVERED_BY, PROCESS_PHASES } from "@/lib/data/process";
import ui from "@/components/home/home.module.css";
import styles from "./phases.module.css";
import PhaseSpy from "./PhaseSpy";
import PhaseStage from "./PhaseStage";

/**
 * "The Paper Trail": the five phases as articles along a spine that fills as you read. On wide
 * screens a sticky dossier beside them collects each phase's written deliverables; on phones a
 * slim sticky rail tracks the count and each phase deals its own sheets in place.
 */
export default function Phases() {
  return (
    <section id="phases" className={`${ui.paper} ${ui.section} ${styles.section}`} aria-labelledby="phases-title">
      <div className={ui.wrap}>
        <div className={styles.head}>
          <p className={ui.eyebrow} data-reveal="up">
            <span className={ui.slash} aria-hidden="true" />
            <b>01</b> The paper trail
          </p>
          <h2 id="phases-title" className={`${ui.h2} ${styles.h2}`} data-reveal="up">
            Every phase hands you something in writing.
          </h2>
          <p className={ui.lede} data-reveal="up">
            Five phases, {DELIVERABLES.length} written deliverables. Each one is yours to keep.
          </p>
        </div>

        <div className={styles.trail} data-phases>
          <div className={styles.rail} aria-hidden="true">
            <span className={styles.now}>
              <span data-ph="0">Starts at Understand</span>
              {PROCESS_PHASES.map((phase, k) => (
                <span key={phase.key} data-ph={k + 1}>
                  {phase.n} · {phase.title}
                </span>
              ))}
              <span data-ph="all">All five phases</span>
            </span>
            <span className={styles.ticks}>
              {PROCESS_PHASES.map((phase, k) => (
                <span key={phase.key} className={styles.tick} style={{ "--k": k + 1 } as CSSProperties} />
              ))}
            </span>
            <span className={styles.railCount}>
              <b />/{DELIVERABLES.length}
            </span>
          </div>

          <div className={styles.list}>
            {PROCESS_PHASES.map((phase, k) => (
              <article
                key={phase.key}
                id={phase.key}
                className={styles.phase}
                data-phase
                data-k={k + 1}
                data-cum={DELIVERED_BY[phase.key]}
                style={{ "--k": k + 1 } as CSSProperties}
                aria-labelledby={`${phase.key}-title`}
              >
                <div className={styles.phaseHead}>
                  <span className={styles.num} aria-hidden="true">
                    {phase.n}
                  </span>
                  <span className={styles.phaseLabel}>Phase {phase.n}</span>
                </div>
                <h3 id={`${phase.key}-title`} className={styles.phaseTitle}>
                  {phase.title}
                </h3>
                <p className={styles.lead}>{phase.lead}</p>
                <p className={styles.receiveLabel}>You receive</p>
                <ul className={styles.receive} data-reveal="deal">
                  {phase.receive.map((item, j) => (
                    <li key={item} style={{ "--j": j } as CSSProperties}>
                      <span className={styles.docIcon} aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <PhaseStage />
        </div>
        <PhaseSpy />
      </div>
    </section>
  );
}
