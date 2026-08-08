"use client";

import { useEffect, useRef, useState } from "react";
import { useCountUp } from "./useCountUp";

interface KpiStatProps {
  value: number;
  decimals?: number;
  /** Literal suffix rendered after the number (e.g. "%"). */
  suffix?: string;
  /** Unit label rendered after the number (e.g. "days"). */
  unit?: string;
  duration?: number;
}

/**
 * Count-up stat that begins animating once it scrolls into view.
 * Honors prefers-reduced-motion by snapping straight to the final value.
 */
export default function KpiStat({ value, decimals = 0, suffix = "", unit = "", duration = 1400 }: KpiStatProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Bridging to a browser API unavailable at SSR time, not derivable during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInView(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          setInView(true);
          io.disconnect();
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const text = useCountUp(value, { start: inView, duration, decimals });

  return (
    <span ref={ref}>
      {text}
      {suffix}
      {unit && <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400 }}> {unit}</span>}
    </span>
  );
}
