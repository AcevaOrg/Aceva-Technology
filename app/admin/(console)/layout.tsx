import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin/auth";

/**
 * Every signed-in console route renders inside this frame. The check here keeps unauthenticated visitors
 * from ever being served the shell, but layouts do not re-render on client navigation between sibling
 * pages, so each page and each data call must ALSO verify the session itself (requireAdminPage in pages,
 * the API guard in routes). Never rely on this layout alone.
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminPage();
  return <AdminShell expiresAt={session.expiresAt}>{children}</AdminShell>;
}
