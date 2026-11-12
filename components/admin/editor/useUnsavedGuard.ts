"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { guardedDestination } from "./editorGuard";

export interface UnsavedGuard {
  /** A navigation that was held back, waiting for the person's answer. */
  pendingHref: string | null;
  /** Leave anyway: forgets the unsaved work and goes where the held link pointed. */
  confirmLeave: () => void;
  /** Stay and keep editing. */
  stay: () => void;
  /** Called right before the editor itself navigates after a successful save, so it is not asked about. */
  release: () => void;
}

/**
 * The unsaved-changes guard: `beforeunload` for reloads, closed tabs and other sites, and a
 * capture-phase click listener for in-app links (the router offers no hook for those). The click
 * listener runs before React sees the event, so a held link's own handler never fires.
 */
export function useUnsavedChangesGuard(dirty: boolean): UnsavedGuard {
  const router = useRouter();
  const [released, setReleased] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const armedRef = useRef(false);
  const armed = dirty && !released;

  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);

  useEffect(() => {
    if (!armed) return;
    const warn = (event: BeforeUnloadEvent) => {
      // Browsers show their own wording; setting returnValue is what makes older ones ask at all.
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [armed]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!armedRef.current) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const destination = guardedDestination(
        {
          href: anchor.getAttribute("href"),
          target: anchor.getAttribute("target"),
          download: anchor.hasAttribute("download"),
          button: event.button,
          modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
          defaultPrevented: event.defaultPrevented,
        },
        window.location,
      );
      if (!destination) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(destination);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const confirmLeave = useCallback(() => {
    const href = pendingHref;
    setPendingHref(null);
    armedRef.current = false;
    setReleased(true);
    if (href) router.push(href);
  }, [pendingHref, router]);

  const stay = useCallback(() => setPendingHref(null), []);

  const release = useCallback(() => {
    armedRef.current = false;
    setReleased(true);
  }, []);

  return { pendingHref, confirmLeave, stay, release };
}
