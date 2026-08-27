"use client";

import React from "react";
import styles from "./pulse.module.css";
import { PulseStage } from "./types";

interface PulseHeaderProps {
  stage: PulseStage;
  step: number;
  onClose: () => void;
  onRestart: () => void;
}

const STEP_BADGES: Record<number, string> = {
  0: "READING THE SYSTEM",
  1: "MAPPING FRICTION",
  2: "BUILDING CONTEXT",
  3: "FORMING DIRECTION",
  4: "SYSTEM FIT",
};

export default function PulseHeader({ stage, step, onClose, onRestart }: PulseHeaderProps) {
  const currentBadge =
    ["direction", "contact", "confirmation"].includes(stage)
      ? "DIRECTION FOUND"
      : STEP_BADGES[Math.min(step, 4)] || "READING THE SYSTEM";

  return (
    <header className={styles.pulseHead}>
      <div className={styles.pulseBrand}>
        ACEVA <span>/</span> PULSE
        <small>
          <i aria-hidden="true" /> {currentBadge}
        </small>
      </div>

      <div className={styles.pulseActions}>
        {stage !== "intent" && (
          <button type="button" onClick={onRestart} aria-label="Restart Pulse session">
            RESTART
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close Pulse modal">
          CLOSE <b>×</b>
        </button>
      </div>
    </header>
  );
}
