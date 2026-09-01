"use client";

import { useEffect, useState } from "react";
import { usePulse } from "./PulseContext";
import styles from "./FloatingPulseButton.module.css";

const CALLOUT_SHOW_DELAY = 900;
const CALLOUT_VISIBLE_FOR = 4500;

export default function FloatingPulseButton() {
  const { openPulse } = usePulse();
  const [calloutVisible, setCalloutVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setCalloutVisible(true), CALLOUT_SHOW_DELAY);
    const hideTimer = setTimeout(
      () => setCalloutVisible(false),
      CALLOUT_SHOW_DELAY + CALLOUT_VISIBLE_FOR
    );
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div className={styles.root}>
      <div
        className={`${styles.callout} ${calloutVisible ? styles.calloutVisible : ""}`.trim()}
        aria-hidden="true"
      >
        <span className={styles.calloutDot} />
        Ask Aceva Pulse
      </div>

      <button
        type="button"
        className={styles.button}
        onClick={openPulse}
        aria-label="Ask Aceva Pulse"
      >
        <span className={styles.iconWrap}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12h4l2.5-7 4 14 3-10.5 1.5 3.5h5" />
          </svg>
          <span className={styles.liveDot} />
        </span>
      </button>
    </div>
  );
}
