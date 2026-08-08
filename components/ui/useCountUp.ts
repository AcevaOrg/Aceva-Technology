"use client";

import { useEffect, useState } from "react";

interface UseCountUpOptions {
  /** Begin animating when this becomes true (e.g. when scrolled into view). */
  start?: boolean;
  /** Animation length in milliseconds. */
  duration?: number;
  /** Decimal places to display (e.g. 2 renders "2.40"). */
  decimals?: number;
}

/**
 * Lightweight rAF count-up. Starts from 0 and eases to `target`.
 * Honors prefers-reduced-motion by snapping straight to the final value.
 */
export function useCountUp(target: number, { start = true, duration = 1400, decimals = 0 }: UseCountUpOptions = {}) {
  const [display, setDisplay] = useState(() => (start ? target.toFixed(decimals) : "0"));

  useEffect(() => {
    if (!start) return;

    // Bridging to a browser API unavailable at SSR time, not derivable during render.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(target.toFixed(decimals));
      return;
    }

    let rafId: number;
    let startTime: number | null = null;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay((target * eased).toFixed(decimals));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [start, target, duration, decimals]);

  return display;
}
