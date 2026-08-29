"use client";

import React, { useEffect, useState } from "react";
import styles from "./pulse.module.css";

interface PulseButtonProps {
  onClick: () => void;
  expandedState?: boolean;
  activeContextText?: string;
  className?: string;
}

export default function PulseButton({
  onClick,
  expandedState = false,
  activeContextText,
  className = "",
}: PulseButtonProps) {
  const [autoExpanded, setAutoExpanded] = useState(false);

  useEffect(() => {
    // Subtle initial expanding state animation like demo
    const timer1 = setTimeout(() => setAutoExpanded(true), 4800);
    const timer2 = setTimeout(() => setAutoExpanded(false), 9200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const isExpanded = expandedState || autoExpanded;
  const labelText = activeContextText || (isExpanded ? "TURN AN IDEA INTO DIRECTION" : "PULSE");

  return (
    <button
      type="button"
      className={`${styles.pulseTrigger} ${isExpanded ? styles.expanded : ""} ${className}`.trim()}
      onClick={onClick}
      aria-label="Open ACEVA Pulse — turn your idea into a direction"
    >
      <span className={styles.liveDot} aria-hidden="true" />
      <span>{labelText}</span>
      <em>Turn your idea into a direction.</em>
    </button>
  );
}
