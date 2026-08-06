"use client";

import styles from "./Footer.module.css";

export default function BackToTopButton() {
  return (
    <button
      type="button"
      aria-label="Back to top"
      className={styles.topBtn}
      onClick={() =>
        window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
      }
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 20V4m0 0-6 6m6-6 6 6" />
      </svg>
    </button>
  );
}
