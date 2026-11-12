import styles from "@/components/documents/verify.module.css";

/**
 * Shown while a code is looked up (and while /verify itself renders). Without its own file the
 * site's root loading state would flash the homepage skeleton here. Server-only, no JavaScript;
 * the pulse stops under reduced motion.
 */
export default function Loading() {
  return (
    <div className={styles.loadShell} role="status" aria-busy="true">
      <div className={styles.loadInner}>
        <span className={styles.loadRing} aria-hidden="true" />
        <div className={styles.loadCopy}>
          <p className={styles.loadLabel}>Checking the registry…</p>
          <span className={styles.loadBar} aria-hidden="true" />
          <span className={`${styles.loadBar} ${styles.loadBarShort}`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
