"use client";

import { useEffect } from "react";

/**
 * Gives the hero's specimen cascade a few pixels of parallax. Precise pointers only, never
 * under reduced motion, and it only writes two custom properties (--mx, --my).
 */
export default function PointerDrift() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const hero = document.querySelector<HTMLElement>("[data-exp-hero]");
    const cascade = document.querySelector<HTMLElement>("[data-exp-cascade]");
    if (!hero || !cascade) return;

    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      cascade.style.setProperty("--mx", x.toFixed(3));
      cascade.style.setProperty("--my", y.toFixed(3));
    };
    const onMove = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      x = 0;
      y = 0;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    return () => {
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
      cascade.style.removeProperty("--mx");
      cascade.style.removeProperty("--my");
    };
  }, []);

  return null;
}
