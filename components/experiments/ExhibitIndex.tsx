"use client";

import { useEffect, useRef, useState } from "react";
import { EXPERIMENTS } from "@/lib/data/experiments";
import { c } from "./cx";

/**
 * The one index for the page. It rests on the hero and docks under the header from 768px up.
 * A plain list of in-page links (every chapter is visible content, so this is not a tablist).
 * Scrolling updates a per-chapter progress line with `style.setProperty`; React state changes
 * only when the active chapter does. Clicking sets the active item at once and ignores the
 * scrollspy until the scroll settles, so a smooth scroll doesn't flicker through chapters.
 */
export default function ExhibitIndex() {
  const [active, setActive] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const lockUntil = useRef(0);
  const current = useRef<string | null>(null);

  useEffect(() => {
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const chapters = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"));
    let frame = 0;

    const update = () => {
      frame = 0;
      // Just below the header and the docked index, so a deep-linked chapter counts as the one being read.
      const line = Math.max(window.innerHeight * 0.38, 210);
      let next: string | null = null;
      for (const chapter of chapters) {
        const rect = chapter.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (line - rect.top) / rect.height));
        links.current.get(chapter.id)?.style.setProperty("--prog", progress.toFixed(3));
        if (rect.top <= line && rect.bottom > line) next = chapter.id;
      }
      if (performance.now() < lockUntil.current) return;
      if (next !== current.current) {
        current.current = next;
        setActive(next);
        const el = next ? links.current.get(next) : null;
        const box = scroller.current;
        if (el && box && box.scrollWidth > box.clientWidth + 2) {
          const item = el.parentElement as HTMLElement;
          box.scrollTo({
            left: item.offsetLeft - (box.clientWidth - item.offsetWidth) / 2,
            behavior: reduced() ? "auto" : "smooth",
          });
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const unlock = () => {
      lockUntil.current = 0;
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("scrollend", unlock);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scrollend", unlock);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav className={c("idx")} aria-label="Experiments">
      <div className={c("idx-pill")}>
        <div className={c("idx-scroll")} ref={scroller}>
          <ol>
            {EXPERIMENTS.map((exp) => (
              <li key={exp.slug}>
                <a
                  href={`#${exp.slug}`}
                  data-k={exp.key}
                  aria-current={active === exp.slug ? "true" : undefined}
                  ref={(node) => {
                    if (node) links.current.set(exp.slug, node);
                    else links.current.delete(exp.slug);
                  }}
                  onClick={() => {
                    current.current = exp.slug;
                    setActive(exp.slug);
                    lockUntil.current = performance.now() + 900;
                  }}
                >
                  <span className={c("n")}>{exp.num}</span>
                  <span className={c("full")}>{exp.title}</span>
                  <span className={c("short")} aria-hidden="true">
                    {exp.short}
                  </span>
                  <span className={c("bar")} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </nav>
  );
}
