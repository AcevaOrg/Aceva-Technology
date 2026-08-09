"use client";

import { useEffect, useState } from "react";
import styles from "./BackToTopButton.module.css";

const SHOW_AFTER = 600;

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      className={visible ? `${styles.button} ${styles.visible}` : styles.button}
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
