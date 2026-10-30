import { DELIVERED_BY, PROCESS_PHASES } from "@/lib/data/process";
import ui from "@/components/home/home.module.css";
import styles from "./phases.module.css";
import LoopRing from "./LoopRing";
import PhaseSpy from "./PhaseSpy";
import WeeklyLoop from "./WeeklyLoop";

/**
 * "The Loop": on wide screens a sticky ring beside the phase articles draws its arc as you read
 * and closes back to Understand during Improve. Phones get a slim sticky rail with the ring as a
 * badge. Build carries its own weekly loop.
 */
export default function Phases() {
  return (
    <section id="phases" className={`${ui.paper} ${ui.section} ${styles.section}`} aria-labelledby="phases-title">
      <div className={ui.wrap}>
        <div className={styles.head}>
          <p className={ui.eyebrow} data-reveal="up">
            <span className={ui.slash} aria-hidden="true" />
            <b>01</b> The loop
          </p>
          <h2 id="phases-title" className={`${ui.h2} ${styles.h2}`} data-reveal="up">
            A loop, not a line.
          </h2>
          <p className={ui.lede} data-reveal="up">
            Improve ends with a modernization roadmap you can act on, with us or independently. That roadmap is where the next
            Understand begins.
          </p>
        </div>

        <div className={styles.loop} data-phases>
          <div className={styles.rail} aria-hidden="true">
            <LoopRing variant="mini" />
            <span className={styles.now}>
              <span data-ph="0">Starts at Understand</span>
              {PROCESS_PHASES.map((phase, k) => (
                <span key={phase.key} data-ph={k + 1}>
                  {phase.n} · {phase.title}
                </span>
              ))}
              <span data-ph="all">Five phases, one loop</span>
            </span>
            <span className={styles.railCount}>
              <b />/5
            </span>
          </div>

          <div className={styles.stage}>
            <LoopRing variant="stage" />
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
                aria-labelledby={`${phase.key}-title`}
              >
                <p className={styles.phaseLabel}>
                  <span className={styles.num}>{phase.n}</span>/ 05
                </p>
                <h3 id={`${phase.key}-title`} className={styles.phaseTitle}>
                  {phase.title}
                </h3>
                <p className={styles.lead}>{phase.lead}</p>
                <div className={styles.receiveBlock} data-reveal="up">
                  <p className={styles.receiveLabel}>You receive</p>
                  <ul className={styles.receive}>
                    {phase.receive.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                {phase.key === "build" && <WeeklyLoop />}
              </article>
            ))}
          </div>
        </div>
        <PhaseSpy />
      </div>
    </section>
  );
}
