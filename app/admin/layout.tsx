import type { Metadata } from "next";
import type { ReactNode } from "react";
import styles from "@/components/admin/admin.module.css";

/**
 * The internal console is never indexed or cached by anything downstream. Authentication is deliberately
 * NOT checked here: this layout also wraps /admin/login. The signed-in routes live in the (console) group,
 * whose layout and pages call requireAdminPage().
 */
export const metadata: Metadata = {
  title: { default: "ACEVA Admin", template: "%s · ACEVA Admin" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/**
 * The public header, footer and floating buttons are wrapped in [data-site-chrome] by the root layout, which
 * knows nothing about the console. The console hides them with this rule. It is inline, in the HTML itself,
 * rather than only in admin.module.css: a stylesheet can arrive a moment after the first paint (always in
 * development, where styles are injected by script), and for that moment the public chrome would flash.
 */
const HIDE_PUBLIC_CHROME = "div:has(> main[data-main] > [data-admin-root]) > [data-site-chrome]{display:none !important}";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root} data-admin-root>
      <style>{HIDE_PUBLIC_CHROME}</style>
      {children}
    </div>
  );
}
