"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ADMIN_ROUTES } from "@/lib/nav";
import s from "./admin.module.css";
import { Button } from "./Button";
import { LogoutIcon } from "./icons";
import { useToast } from "./Toast";

interface SignOutButtonProps {
  /** "nav" is a sidebar row; "button" is a ghost pill for a settings page. */
  variant?: "nav" | "button";
}

/**
 * Ends the session: POST /api/admin/logout, then back to the login page. A 401 means the session had
 * already ended, which is the outcome the person asked for, so it also continues to the login page.
 * Must render inside a ToastProvider (AdminShell mounts one).
 */
export function SignOutButton({ variant = "nav" }: SignOutButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "same-origin",
      });
      if (response.ok || response.status === 401) {
        router.replace(ADMIN_ROUTES.login);
        // Drop cached console pages so the back button cannot show them after sign-out.
        router.refresh();
        return;
      }
      toast.error("Could not sign out.", { description: "Please try again." });
    } catch {
      toast.error("Could not sign out.", { description: "Check your connection and try again." });
    }
    setBusy(false);
  }

  if (variant === "button") {
    return (
      <Button variant="ghost" shine={false} loading={busy} iconLeading={<LogoutIcon />} onClick={signOut}>
        Sign out
      </Button>
    );
  }

  return (
    <button type="button" className={s.navItem} disabled={busy} aria-busy={busy || undefined} onClick={signOut}>
      <LogoutIcon className={s.navIcon} />
      <span className={s.navLabel}>{busy ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
