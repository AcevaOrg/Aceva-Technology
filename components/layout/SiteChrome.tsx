import type { ReactNode } from "react";

/**
 * Marks the marketing chrome (ambient background, header pill, footer, floating Pulse button,
 * back-to-top, mobile CTA bar) so a page that brings its own shell can switch it off.
 *
 * This is deliberately a plain server component with no knowledge of any other route. It used to
 * compare `usePathname()` against the internal console's address, which shipped that address in
 * every public page's JavaScript. Now the console's own stylesheet hides anything marked
 * `data-site-chrome` while the console is on screen, so nothing public names it. `display: contents`
 * keeps the wrapper out of layout, so public pages render exactly as before.
 */
export default function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div data-site-chrome style={{ display: "contents" }}>
      {children}
    </div>
  );
}
