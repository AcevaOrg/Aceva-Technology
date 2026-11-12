"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

const noopSubscribe = () => () => {};

/** `false` during server render and hydration, `true` afterwards: gates anything that needs `document`. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tabbable descendants that are actually rendered and not inside an `inert` subtree. */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.getClientRects().length > 0 && !element.closest("[inert]"),
  );
}

interface ModalBehaviourOptions {
  /** Behaviour is attached only while this is true. */
  active: boolean;
  /** The dialog or drawer element: Tab is trapped inside it. */
  containerRef: RefObject<HTMLElement | null>;
  onEscape: () => void;
  /** Element to focus on open. Defaults to the first focusable descendant. */
  initialFocus?: () => HTMLElement | null;
  /**
   * Element to focus on close. Return null to leave focus alone (navigating away should not steal
   * focus from the incoming page). When omitted, focus returns to whatever held it on open.
   */
  returnFocus?: () => HTMLElement | null;
}

/**
 * Everything a modal surface owes its users, mirrored from the marketing header drawer: the page behind
 * does not scroll, focus starts inside, Tab cycles within, Escape dismisses and focus is handed back.
 */
export function useModalBehaviour({ active, containerRef, onEscape, initialFocus, returnFocus }: ModalBehaviourOptions): void {
  const escapeRef = useRef(onEscape);
  const initialRef = useRef(initialFocus);
  const returnRef = useRef(returnFocus);

  // Callers pass fresh closures every render; reading them through refs keeps the main effect from
  // tearing down (and stealing focus back) on each keystroke.
  useEffect(() => {
    escapeRef.current = onEscape;
    initialRef.current = initialFocus;
    returnRef.current = returnFocus;
  });

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // preventScroll: a drawer is still sliding in from off-screen when it takes focus.
    (initialRef.current?.() ?? focusableWithin(container)[0] ?? container).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        escapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableWithin(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !container.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const target = returnRef.current ? returnRef.current() : opener;
      if (target?.isConnected) target.focus();
    };
  }, [active, containerRef]);
}

/**
 * An object URL for previewing a picked file, revoked when the file changes or the component goes away.
 * Held in state (not memoised) so React StrictMode's mount/unmount/mount cycle cannot revoke a URL that
 * is still on screen.
 */
export function useObjectUrl(file: File | null): string | null {
  const [state, setState] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // The URL is a browser resource that must be created and revoked together with this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return state && state.file === file ? state.url : null;
}

/**
 * Wall-clock time rounded down to `bucketMs`, re-read on an interval. 0 during server render, so
 * markup that depends on it renders identically on the server and during hydration.
 */
export function useClockBucket(bucketMs: number): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = window.setInterval(onChange, Math.min(bucketMs, 15_000));
      return () => window.clearInterval(id);
    },
    [bucketMs],
  );
  const getSnapshot = useCallback(() => Math.floor(Date.now() / bucketMs) * bucketMs, [bucketMs]);
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
