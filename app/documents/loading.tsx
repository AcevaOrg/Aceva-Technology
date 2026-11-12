import styles from "@/components/documents/documents.module.css";

/**
 * Shown while /documents reads the registry on client navigation. It mirrors the hero's shape on the
 * dark stage so the page settles without a jump. Server-only, no JavaScript, no animation under
 * reduced motion.
 */
export default function Loading() {
  return (
    <div className={styles.loadShell} role="status" aria-busy="true">
      <span className={styles.srOnly}>Loading documents</span>
      <div className={styles.loadInner} aria-hidden="true">
        <span className={`${styles.loadBar} ${styles.loadKicker}`} />
        <span className={`${styles.loadBar} ${styles.loadTitle}`} />
        <span className={`${styles.loadBar} ${styles.loadTitle} ${styles.loadTitleShort}`} />
        <span className={`${styles.loadBar} ${styles.loadText}`} />
        <span className={`${styles.loadBar} ${styles.loadText} ${styles.loadTextShort}`} />
        <span className={styles.loadRow}>
          {[0, 1, 2, 3].map((n) => (
            <span key={n} className={`${styles.loadBar} ${styles.loadChip}`} />
          ))}
        </span>
      </div>
    </div>
  );
}
