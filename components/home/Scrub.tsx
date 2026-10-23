"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

interface ScrubProps {
  /**
   * Viewport fraction where progress starts (element top meets it) and where it ends
   * (element bottom meets it). `start=1, end=0` covers the element's whole pass.
   */
  start?: number;
  end?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Writes scroll progress (0 → 1) to the `--p` custom property on its own element.
 * No React state on scroll: one passive listener + rAF, attached only while in view.
 * CSS reads `var(--p, <final>)`, so without JS or with reduced motion the finished
 * state renders.
 */
export default function Scrub({ start = 1, end = 0, className, style, children }: ScrubProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let listening = false;

    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const span = rect.height + vh * (start - end);
      const progress = span > 0 ? (vh * start - rect.top) / span : 1;
      el.style.setProperty("--p", Math.min(1, Math.max(0, progress)).toFixed(4));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
      } else {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      listen(entry.isIntersecting);
      update();
    });
    io.observe(el);

    return () => {
      io.disconnect();
      listen(false);
      cancelAnimationFrame(frame);
      el.style.removeProperty("--p");
    };
  }, [start, end]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
