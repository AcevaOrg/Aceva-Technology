"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** There is no media query on the server; assume motion is allowed, then correct on hydration. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Reads the user's reduced-motion preference.
 *
 * Uses `useSyncExternalStore` rather than reading `matchMedia` into state inside an
 * effect. The effect version rendered once with the wrong value and then immediately
 * re-rendered, which is the cascading-render pattern `react-hooks/set-state-in-effect`
 * flags — and it was duplicated in seventeen loading skeletons.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
