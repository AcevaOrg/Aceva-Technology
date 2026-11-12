import type { ReactNode } from "react";
import s from "./admin.module.css";
import { AdminBrand } from "./AdminBrand";
import { AdminNav } from "./AdminNav";
import { AdminTopbar } from "./AdminTopbar";
import { ToastProvider } from "./Toast";

interface AdminShellProps {
  /** When the signed-in session ends, epoch milliseconds (the `expiresAt` of requireAdminPage()). */
  expiresAt?: number;
  children: ReactNode;
}

/**
 * The console frame: a sticky 260px sidebar on wide screens, a sticky topbar with a menu drawer on narrow
 * ones, and the page in between. It mounts the ToastProvider, so `useToast()` works in every page below.
 *
 * The root layout already renders `main#main-content`, so the content slot is a plain div: a nested
 * <main> would be invalid. A second skip link jumps past the navigation to that div.
 */
export function AdminShell({ expiresAt, children }: AdminShellProps) {
  return (
    <ToastProvider>
      <a className={s.skipLink} href="#admin-content">
        Skip to console content
      </a>
      <div className={s.shell}>
        <div className={s.sidebar}>
          <AdminBrand idSuffix="sidebar" />
          <AdminNav />
        </div>
        <div className={s.mainCol}>
          <AdminTopbar expiresAt={expiresAt} />
          <div id="admin-content" tabIndex={-1} className={s.content}>
            {children}
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
