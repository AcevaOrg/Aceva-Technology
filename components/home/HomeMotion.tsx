"use client";

import { useEffect } from "react";

/**
 * Single reveal controller for the homepage.
 *
 * Content is server-rendered fully visible. After hydration, only `[data-reveal]`
 * elements that start below the fold are "armed" (hidden by CSS), then revealed once
 * by one shared IntersectionObserver. Nothing on screen is ever hidden, so there is no
 * flash, no invisible content without JavaScript, and nothing at all under reduced motion.
 */
export default function HomeMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    const root = document.querySelector<HTMLElement>("[data-home-root]");
    if (!root) return;

    const fold = window.innerHeight * 0.92;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]:not([data-in])")).filter(
      (el) => el.getBoundingClientRect().top > fold
    );

    const onWipeEnd = (event: TransitionEvent) => {
      if (event.propertyName !== "clip-path") return;
      const el = event.currentTarget as HTMLElement;
      el.setAttribute("data-done", "");
      el.removeEventListener("transitionend", onWipeEnd);
    };

    const reveal = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        if (el.dataset.reveal === "wipe") el.addEventListener("transitionend", onWipeEnd);
        el.setAttribute("data-in", "");
        observer.unobserve(el);
      }
    };

    const io = new IntersectionObserver(reveal, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    // Chrome measures a target through its own clip-path, so a fully clipped wipe always
    // reports a ratio of 0: watch those for any intersection, a little deeper in the viewport.
    const wipeIo = new IntersectionObserver(reveal, { rootMargin: "0px 0px -18% 0px", threshold: 0 });

    for (const el of targets) {
      el.setAttribute("data-armed", "");
      (el.dataset.reveal === "wipe" ? wipeIo : io).observe(el);
    }

    return () => {
      io.disconnect();
      wipeIo.disconnect();
      // Never leave content hidden without an observer to reveal it (e.g. a re-run effect).
      for (const el of targets) {
        if (!el.hasAttribute("data-in")) el.removeAttribute("data-armed");
      }
    };
  }, []);

  return null;
}
