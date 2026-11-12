import s from "@/components/admin/admin.module.css";

/**
 * The top-level fallback for everything under the console.
 *
 * Without it, the nearest loading boundary above the console is the site-wide one, which draws the
 * homepage skeleton inside the public header and footer. So for the instant the console's own layout was
 * still being prepared, visitors saw the public site's chrome flash on screen. This fallback renders inside
 * app/admin/layout.tsx's wrapper, whose stylesheet carries the rule that hides the public chrome, so that
 * chrome never shows. Server-only, no JavaScript.
 */
export default function AdminLoading() {
  return (
    <div role="status" aria-busy="true" style={{ minHeight: "100svh", display: "grid", placeItems: "center" }}>
      <span className={s.srOnly}>Loading</span>
      <span
        aria-hidden="true"
        className={s.skel}
        style={{ width: 28, height: 44, clipPath: "polygon(62% 0, 100% 0, 38% 100%, 0 100%)" }}
      />
    </div>
  );
}
