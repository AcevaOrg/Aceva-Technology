import type { ReactNode } from "react";
import { InfoIcon } from "../icons";
import ed from "./editor.module.css";

interface SetupNoticeProps {
  title: string;
  tone?: "warn" | "error";
  children: ReactNode;
}

/** A calm explanation shown instead of a crash when the database is missing or cannot be reached. */
export function SetupNotice({ title, tone = "warn", children }: SetupNoticeProps) {
  return (
    <div className={ed.banner} data-tone={tone} role="status">
      <InfoIcon width={18} height={18} />
      <p>
        <b>{title}</b> {children}
      </p>
    </div>
  );
}

/** What to do when no database is configured. Never names a secret, only the settings to look at. */
export function DatabaseSetupNotice() {
  return (
    <SetupNotice title="The document registry is not connected.">
      Set <code>DATABASE_URL</code> (or <code>ACEVA_LOCAL_DB=1</code> for the local database), run <code>npm run migrate:documents</code>, then reload
      this page. You can look around, but nothing can be saved until then.
    </SetupNotice>
  );
}
