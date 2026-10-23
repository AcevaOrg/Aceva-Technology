import styles from "@/components/home/loading.module.css";

/**
 * Root loading skeleton, shown on client navigation to the homepage.
 * Mirrors the homepage hero (dark stage, left-aligned headline, capability index)
 * so the page settles without a visual jump. Server-only, no JavaScript.
 */
export default function Loading() {
  return (
    <div className={styles.shell} role="status" aria-busy="true">
      <span className={styles.srOnly}>Loading</span>
      <div className={styles.inner} aria-hidden="true">
        <span className={`${styles.bar} ${styles.kicker}`} />
        <span className={`${styles.bar} ${styles.title}`} />
        <span className={`${styles.bar} ${styles.title} ${styles.titleTwo}`} />
        <span className={`${styles.bar} ${styles.title} ${styles.titleThree}`} />
        <span className={`${styles.bar} ${styles.text}`} />
        <span className={`${styles.bar} ${styles.text} ${styles.textShort}`} />
        <span className={styles.actions}>
          <span className={`${styles.bar} ${styles.button}`} />
          <span className={`${styles.bar} ${styles.button} ${styles.ghost}`} />
        </span>
        <span className={styles.index}>
          {[0, 1, 2, 3, 4].map((n) => (
            <span key={n} className={`${styles.bar} ${styles.indexItem}`} />
          ))}
        </span>
      </div>
    </div>
  );
}
