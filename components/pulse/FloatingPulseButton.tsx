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
        Hello I&apos;m Aceva, Let&apos;s chat!
      </div>

      <button
        type="button"
        className={styles.button}
        onClick={openPulse}
        aria-label="Ask Aceva Pulse"
      >
        <span className={styles.iconWrap}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className={styles.robotSvg}
          >
            <defs>
              {/* Helmet gradient: polished metallic white to silver-blue */}
              <linearGradient id="acevaHelmet" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>

              {/* Visor gradient: Aceva Navy #0f1e4d to deep Void */}
              <linearGradient id="acevaVisor" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0f1e4d" />
                <stop offset="100%" stopColor="#0a0a0c" />
              </linearGradient>

              {/* Eye & Accent Radial Glow: Aceva Ice #7fb2ff to Electric #3b7cff */}
              <radialGradient id="acevaEyeGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#7fb2ff" />
                <stop offset="100%" stopColor="#3b7cff" />
              </radialGradient>

              {/* Ear & Stalk Gradient: Aceva Royal to Electric */}
              <linearGradient id="acevaEarGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1e4fd9" />
                <stop offset="100%" stopColor="#3b7cff" />
              </linearGradient>
            </defs>

            {/* Antenna Stalk & Glowing Orb */}
            <path d="M16 2.5v3.5" stroke="url(#acevaEarGlow)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="16" cy="2.5" r="2" fill="#7fb2ff" />
            <circle cx="16" cy="2.5" r="3.5" fill="#7fb2ff" opacity="0.35" />

            {/* Side Ear Capsules */}
            <rect x="2.5" y="14" width="3" height="7" rx="1.5" fill="url(#acevaEarGlow)" />
            <rect x="26.5" y="14" width="3" height="7" rx="1.5" fill="url(#acevaEarGlow)" />

            {/* Main Robot Head Helmet */}
            <rect x="5" y="7" width="22" height="20" rx="7" fill="url(#acevaHelmet)" />

            {/* Top Helmet Gloss Highlight */}
            <path
              d="M9 9.5c3.5-1.2 10.5-1.2 14 0"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Visor Screen with Aceva Electric stroke */}
            <rect x="8" y="11" width="16" height="11" rx="4" fill="url(#acevaVisor)" stroke="#3b7cff" strokeWidth="1" />

            {/* Visor Reflection */}
            <path d="M9.5 12.5h3" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.35" />

            {/* Left Glowing Eye (Aceva Ice #7fb2ff) */}
            <circle cx="12" cy="15.5" r="2" fill="url(#acevaEyeGlow)" />
            <circle cx="12" cy="15.5" r="3" fill="#7fb2ff" opacity="0.3" />
            <circle cx="11.4" cy="14.9" r="0.6" fill="#ffffff" />

            {/* Right Glowing Eye (Aceva Ice #7fb2ff) */}
            <circle cx="20" cy="15.5" r="2" fill="url(#acevaEyeGlow)" />
            <circle cx="20" cy="15.5" r="3" fill="#7fb2ff" opacity="0.3" />
            <circle cx="19.4" cy="14.9" r="0.6" fill="#ffffff" />

            {/* Cheek Accent Dots (Aceva Success / Mint) */}
            <circle cx="10" cy="18.5" r="0.75" fill="#2fbe7a" opacity="0.7" />
            <circle cx="22" cy="18.5" r="0.75" fill="#2fbe7a" opacity="0.7" />

            {/* Friendly Smiling Mouth */}
            <path
              d="M13.5 18.8c.8.8 2.2.8 3 0"
              stroke="#7fb2ff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.liveDot} />
        </span>
      </button>
    </div>
  );
}
