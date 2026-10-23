"use client";

import { usePulse } from "@/components/pulse/PulseContext";
import styles from "./proof.module.css";

/** Opens the real on-site assistant: live proof of the Intelligence & Automation capability. */
export default function PulseTile() {
  const { openPulse } = usePulse();

  return (
    <button type="button" className={styles.pulseButton} onClick={openPulse}>
      <span className={styles.pulseIcon} aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12h4l2.5-7 4 14 3-10.5 1.5 3.5h5" />
        </svg>
      </span>
      Ask Aceva Pulse
    </button>
  );
}
