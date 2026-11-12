/**
 * Moves focus to a form control by id and brings it into view. Composite controls (a segmented
 * control, a file drop) put the id on a wrapper or on a zone, so this looks inside when the element
 * itself cannot take focus. Browser-only; returns whether anything was focused.
 */
export function focusControl(id: string): boolean {
  if (typeof document === "undefined") return false;
  // A file drop has no element with its base id: its empty zone has `-zone`, and the cell around it `-cell`.
  const element = document.getElementById(id) ?? document.getElementById(`${id}-zone`) ?? document.getElementById(`${id}-cell`);
  if (!element) return false;

  const direct = element.matches("input, select, textarea, button, a[href]");
  const target = direct
    ? element
    : element.querySelector<HTMLElement>('[tabindex="0"], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
  const focusable = target ?? element;
  if (focusable.tabIndex < 0 && !target) focusable.setAttribute("tabindex", "-1");

  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  focusable.focus({ preventScroll: true });
  focusable.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  return true;
}
