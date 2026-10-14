"use client";

import React from "react";
import styles from "./pulse.module.css";
import { PulseStage } from "./types";
import { DISCOVERY_STEPS } from "@/lib/pulse/discoverySteps";

interface PulseHeaderProps {
  stage: PulseStage;
  step: number;
  onClose: () => void;
  onRestart: () => void;
}

// Derived from the step definitions rather than duplicated: the hardcoded copy
// had drifted, badging step 4 as "SYSTEM FIT" while the panel heading below it
// read "TIMELINE & BUDGET FIT".
const LAST_STEP = DISCOVERY_STEPS.length - 1;

export default function PulseHeader({ stage, step, onClose, onRestart }: PulseHeaderProps) {
  const currentBadge =
    ["direction", "contact", "confirmation"].includes(stage)
      ? "DIRECTION FOUND"
      : DISCOVERY_STEPS[Math.min(Math.max(step, 0), LAST_STEP)]?.label ?? DISCOVERY_STEPS[0].label;

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
