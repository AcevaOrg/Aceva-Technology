import type { CSSProperties } from "react";
import { PROCESS_COMMITMENTS, WONT_PROMISE } from "@/lib/data/process";
import ui from "@/components/home/home.module.css";
import styles from "./process.module.css";

/** The commitments that hold in every phase, and the promises we refuse to make. */
export default function Rules() {
  return (
    <section id="rules" className={`${ui.ink} ${ui.section}`} aria-labelledby="rules-title">
      <div className={ui.wrap}>
        <div className={styles.headRow}>
          <div>
            <p className={ui.eyebrow} data-reveal="up">
              <span className={ui.slash} aria-hidden="true" />
              <b>04</b> In every phase
            </p>
            <h2 id="rules-title" className={`${ui.h2} ${styles.h2}`} data-reveal="up">
              Rules that do not bend.
            </h2>
          </div>
        </div>

        <ol className={styles.rules}>
          {PROCESS_COMMITMENTS.map((rule, i) => (
            <li key={rule.title} className={styles.rule} data-reveal="up" style={{ "--d": `${i * 90}ms` } as CSSProperties}>
              <span className={styles.ruleNum} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3>{rule.title}</h3>
              <p>{rule.body}</p>
            </li>
          ))}
        </ol>

        <div className={styles.limits} data-reveal="up">
          <div className={styles.limitsHead}>
            <h3>What we won’t promise</h3>
            <p>Honest limits, so the plan you approve is one we can keep.</p>
          </div>
          <ul className={styles.limitList}>
            {WONT_PROMISE.map((line) => (
              <li key={line.label}>
                <span>{line.label}</span>
                {line.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
