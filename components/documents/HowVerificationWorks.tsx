import type { CSSProperties } from "react";
import Scrub from "@/components/home/Scrub";
import ui from "@/components/home/home.module.css";
import { HOW_IT_WORKS } from "./content";
import styles from "./documents.module.css";

/** Scan, check, trust: the closing strip. Three columns that fill in as it scrolls into view. */
export default function HowVerificationWorks() {
  return (
    <section id="how-verification-works" className={`${ui.paper2} ${styles.section}`} aria-labelledby="how-heading">
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>
          <i className={styles.slash} />
          {HOW_IT_WORKS.eyebrow}
        </p>
        <h2 id="how-heading" className={`${styles.h2} ${styles.howTitle}`} data-reveal="up">
          {HOW_IT_WORKS.title}
        </h2>
        <Scrub start={0.95} end={0.4} className={styles.steps} style={{ "--n": HOW_IT_WORKS.steps.length } as CSSProperties}>
          <ol className={styles.stepList}>
            {HOW_IT_WORKS.steps.map((step, i) => (
              <li key={step.kicker} className={styles.step} style={{ "--i": i } as CSSProperties}>
                <span className={styles.k}>{step.kicker}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </Scrub>
      </div>
    </section>
  );
}
