"use client";

import React, { useEffect, useRef } from "react";
import styles from "./pulse.module.css";
import { usePulse } from "./PulseContext";
import PulseHeader from "./PulseHeader";
import PulseMapPanel from "./PulseMapPanel";
import PulseFooter from "./PulseFooter";
import PulseMessages from "./PulseMessages";

export default function PulseOverlay() {
  const { state, dispatch } = usePulse();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trapping and scroll locking
  useEffect(() => {
    if (!state.open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    // Auto focus first interactive element
    dialogRef.current
      ?.querySelector<HTMLElement>("button:not([disabled]), input, textarea")
      ?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dispatch({ type: "CLOSE" });
      }

      if (e.key === "Tab") {
        const focusables = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input, textarea, select, [tabindex="0"]'
          ) || []
        );
        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [state.open, dispatch]);

  if (!state.open) return null;

  // Calculate score percentage (0-100%) matching step and stage progression
  const score = Math.min(
    96,
    ["direction", "contact", "confirmation"].includes(state.stage)
      ? 94
      : 12 + 17 * state.step
  );

  return (
    <div
      className={styles.pulseOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="ACEVA Pulse Chatbot"
      ref={dialogRef}
    >
      <PulseHeader
        stage={state.stage}
        step={state.step}
        onClose={() => dispatch({ type: "CLOSE" })}
        onRestart={() => dispatch({ type: "RESTART" })}
      />

      <div className={styles.pulseGrid}>
        <section className={styles.discoveryPanel}>
          <PulseMessages state={state} dispatch={dispatch} />
        </section>

        <PulseMapPanel state={state} score={score} />
      </div>

      <PulseFooter score={score} />
    </div>
  );
}
