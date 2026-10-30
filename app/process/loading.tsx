import styles from "@/components/home/loading.module.css";

/**
 * Process loading skeleton: the hero's shape on the dark stage (the headline, the lede, and the
 * five phase links). Server-only, no JavaScript, same pattern as app/loading.tsx.
 */
export default function Loading() {
  return (
    <div className={styles.shell} role="status" aria-busy="true">
      <span className={styles.srOnly}>Loading</span>
      <div className={styles.inner} aria-hidden="true">
        <span className={`${styles.bar} ${styles.kicker}`} />
        <span className={`${styles.bar} ${styles.title}`} />
        <span className={`${styles.bar} ${styles.title} ${styles.titleTwo}`} />
        <span className={`${styles.bar} ${styles.text}`} />
        <span className={`${styles.bar} ${styles.text} ${styles.textShort}`} />
        <span className={styles.index}>
          {[0, 1, 2, 3, 4].map((n) => (
            <span key={n} className={`${styles.bar} ${styles.indexItem}`} />
          ))}
        </span>
      </div>
    </div>
  );
}
