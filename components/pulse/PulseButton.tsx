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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    // Subtle initial expanding state animation only on desktop
    if (typeof window !== "undefined" && window.innerWidth > 768) {
      const timer1 = setTimeout(() => setAutoExpanded(true), 4800);
      const timer2 = setTimeout(() => setAutoExpanded(false), 9200);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        window.removeEventListener("resize", checkMobile);
      };
    }

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // On mobile screens, strictly show "PULSE"
  const isExpanded = !isMobile && (expandedState || autoExpanded);
  const labelText = isMobile ? "PULSE" : activeContextText || (isExpanded ? "TURN AN IDEA INTO DIRECTION" : "PULSE");

  return (
    <button
      type="button"
      className={`${styles.pulseTrigger} ${isExpanded ? styles.expanded : ""} ${className}`.trim()}
      onClick={onClick}
      aria-label="Open ACEVA Pulse"
    >
      <span className={styles.liveDot} aria-hidden="true" />
      <span>{labelText}</span>
      {!isMobile && <em>Turn your idea into a direction.</em>}
    </button>
  );
}
