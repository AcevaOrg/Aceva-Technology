import type { CSSProperties } from "react";
import { WEEKLY_LOOP } from "./loopSteps";
import styles from "./loop.module.css";

/** Build's inner loop, as an ordered list laid out clockwise; a light steps round it once revealed. */
export default function WeeklyLoop() {
  return (
    <div className={styles.weekly} data-reveal="up">
      <p className={styles.weeklyHead}>
        <span>Inside Build</span>
        <span>Every week</span>
      </p>
      <ol className={styles.steps} role="list">
        {WEEKLY_LOOP.map((step, s) => (
          <li key={step.label} style={{ "--s": s } as CSSProperties}>
            <span className={styles.stepN}>{String(s + 1).padStart(2, "0")}</span>
            <b>{step.label}</b>
            <span>{step.note}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
