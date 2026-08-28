"use client";

import React from "react";
import styles from "./pulse.module.css";

interface PulseFooterProps {
  score: number;
}

export default function PulseFooter({ score }: PulseFooterProps) {
  return (
    <footer className={styles.pulseFooter}>
      <span>ACEVA / DIGITAL DISCOVERY ENVIRONMENT</span>
      <div className={styles.understanding}>
        <span>UNDERSTANDING</span>
        <div>
          <i style={{ width: `${score}%` }} />
        </div>
        <b>{score}%</b>
      </div>
    </footer>
  );
}
