"use client";

import { useEffect, useRef, useState } from "react";
import { useCountUp } from "@/components/ui/useCountUp";
import s from "./admin.module.css";

interface CountUpProps {
  value: number;
  /** Decimal places. Integers by default. */
  decimals?: number;
  duration?: number;
}

/**
 * A number that counts up from zero once it scrolls into view (the same behaviour as the marketing
 * site's KpiStat, with thousands separators). Screen readers get the final value immediately instead of
 * a running tally, and reduced motion snaps straight to it.
 */
export function CountUp({ value, decimals = 0, duration = 1200 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      // Browsers without IntersectionObserver get the final number straight away.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const running = useCountUp(value, { start: inView, duration, decimals });
  const format = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <span ref={ref}>
      <span aria-hidden="true">{format(Number(running))}</span>
      <span className={s.srOnly}>{format(value)}</span>
    </span>
  );
}
