"use client";

import { useEffect } from "react";

/**
 * Drives the phases section from the scroll position, with no React state on scroll.
 * Writes to `[data-phases]`:
 *   --n       phases reached (0–5): a phase counts once its top crosses the middle of the viewport
 *   --ap      progress through the active phase (0–1)
 *   --pp      progress through the whole section (0–1)
 *   --landed  deliverables handed over so far (the active phase's `data-cum`)
 *   data-n    the same as --n, for attribute selectors
 *   data-live set after the first write, so CSS transitions never run on the initial state
 * CSS reads `var(--n, 5)` and friends, so without JavaScript or with reduced motion the
 * finished state renders. Listens only while the section is on screen.
 */
export default function PhaseSpy() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.querySelector<HTMLElement>("[data-phases]");
    const phases = root ? Array.from(root.querySelectorAll<HTMLElement>("[data-phase]")) : [];
    if (!root || !phases.length) return;

    let frame = 0;
    let listening = false;
    let written = "";
    let live = 0;

    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.5;
      let n = 0;
      let ap = 0;
      phases.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= line) {
          n = i + 1;
          ap = Math.min(1, Math.max(0, (line - rect.top) / rect.height));
        }
      });
      const top = phases[0].getBoundingClientRect().top;
      const bottom = phases[phases.length - 1].getBoundingClientRect().bottom;
      const pp = bottom > top ? Math.min(1, Math.max(0, (line - top) / (bottom - top))) : 1;
      const landed = n ? Number(phases[n - 1].dataset.cum ?? 0) : 0;

      const next = `${n}|${ap.toFixed(3)}|${pp.toFixed(3)}`;
      if (next === written) return;
      written = next;
      root.style.setProperty("--n", String(n));
      root.style.setProperty("--ap", ap.toFixed(3));
      root.style.setProperty("--pp", pp.toFixed(3));
      root.style.setProperty("--landed", String(landed));
      root.dataset.n = String(n);
      if (!live) live = requestAnimationFrame(() => root.setAttribute("data-live", ""));
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
    io.observe(root);

    return () => {
      io.disconnect();
      listen(false);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(live);
      for (const prop of ["--n", "--ap", "--pp", "--landed"]) root.style.removeProperty(prop);
      root.removeAttribute("data-n");
      root.removeAttribute("data-live");
    };
  }, []);

  return null;
}
