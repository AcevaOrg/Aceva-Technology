import styles from "./hero-visual.module.css";

/** Baseline hero visual: the slash beam alone. Each design direction replaces this file. */
export default function HeroVisual() {
  return (
    <div className={styles.visual} aria-hidden="true">
      <span className={styles.beam} />
    </div>
  );
}
