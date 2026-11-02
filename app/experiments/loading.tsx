import styles from "@/components/home/loading.module.css";

/**
 * Experiments loading skeleton: the hero's shape on the dark stage (two headline lines, the
 * lede, and the six-item index). Server-only, no JavaScript, same pattern as app/loading.tsx.
 */
export default function Loading() {
  return (
    <div className={styles.shell} role="status" aria-busy="true">
      <span className={styles.srOnly}>Loading</span>
      <div className={styles.inner} aria-hidden="true">
        <span className={`${styles.bar} ${styles.kicker}`} />
        <span className={`${styles.bar} ${styles.title}`} />
        <span className={`${styles.bar} ${styles.title} ${styles.titleTwo} ${styles.titleThree}`} />
        <span className={`${styles.bar} ${styles.text}`} />
        <span className={`${styles.bar} ${styles.text} ${styles.textShort}`} />
        <span className={styles.index}>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={`${styles.bar} ${styles.indexItem}`} />
          ))}
        </span>
      </div>
    </div>
  );
}
