import { adminStyles as ui, ButtonLink, EmptyState, RefreshIcon } from "@/components/admin";
import { ADMIN_ROUTES } from "@/lib/nav";
import s from "./pages.module.css";

/**
 * Calm full-width notices for the two states every data page can be in besides "working": no database
 * configured yet, and a database that did not answer. Neither shows driver text or a connection string:
 * the reason is in the server log, and Settings has the checklist that explains what to fix.
 */

export function SetupNotice() {
  return (
    <div className={s.notice}>
      <EmptyState
        title="Connect a database to continue"
        body="The document registry stores its records in Postgres. Set DATABASE_URL (or ACEVA_LOCAL_DB=1 for local development), then run npm run migrate:documents."
        action={
          <ButtonLink href={ADMIN_ROUTES.settings} variant="ghost">
            Open settings
          </ButtonLink>
        }
      />
    </div>
  );
}

export function DatabaseUnavailable({ retryHref }: { retryHref: string }) {
  return (
    <div className={s.notice}>
      <EmptyState
        title="The database did not answer"
        body="Nothing has been lost. This is usually a brief connection problem, so trying again often works. Settings can tell you whether the connection is configured correctly."
        action={
          <div className={ui.cluster}>
            <ButtonLink href={retryHref} iconLeading={<RefreshIcon />}>
              Try again
            </ButtonLink>
            <ButtonLink href={ADMIN_ROUTES.settings} variant="ghost">
              Check settings
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
