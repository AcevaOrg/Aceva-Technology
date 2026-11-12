/**
 * Decides which clicks on a link should be held back while the editor has unsaved work.
 *
 * Next's router has no "are you sure?" event for client-side navigation, so the editor watches
 * clicks on anchors itself. Only plain, same-origin, same-tab clicks that would change the page are
 * held; anything the browser handles on its own (a new tab, a download, a modified click) is left
 * alone, and a real unload is covered separately by `beforeunload`.
 */

export interface ClickFacts {
  /** The raw `href` attribute, not the resolved URL. */
  href: string | null;
  target: string | null;
  download: boolean;
  /** MouseEvent.button: 0 is the primary button. */
  button: number;
  modified: boolean;
  defaultPrevented: boolean;
}

export interface CurrentLocation {
  origin: string;
  pathname: string;
  search: string;
}

/** The path (with query and hash) to navigate to once the person agrees to leave, or null to let the click through. */
export function guardedDestination(facts: ClickFacts, current: CurrentLocation): string | null {
  if (facts.defaultPrevented || facts.button !== 0 || facts.modified || facts.download) return null;
  if (facts.target && facts.target !== "_self") return null;
  const href = facts.href?.trim();
  if (!href || href.startsWith("#")) return null;

  let url: URL;
  try {
    url = new URL(href, current.origin);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // Another site is a real unload: `beforeunload` asks about it.
  if (url.origin !== current.origin) return null;
  // Same page, different hash: nothing is being left.
  if (url.pathname === current.pathname && url.search === current.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
