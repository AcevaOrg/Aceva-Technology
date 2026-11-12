import type { Metadata } from "next";
import { adminStyles as ui, PageHeader, Panel, SignOutButton } from "@/components/admin";
import { cx } from "@/components/admin/utils";
import { probeDatabase } from "@/components/admin/pages/data";
import { buildHealthChecks, summarizeHealth, type DatabaseFacts, type HealthFacts } from "@/components/admin/pages/health";
import { HealthBanner, HealthChecklist } from "@/components/admin/pages/HealthChecklist";
import s from "@/components/admin/pages/pages.module.css";
import {
  MIN_PASSKEY_LENGTH,
  getAdminPasskey,
  getAllowedAdminHosts,
  getMaxUploadBytes,
  getSessionSecret,
  getSessionTtlSeconds,
} from "@/lib/admin/config";
import { requireAdminPage } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { ADMIN_ROUTES } from "@/lib/nav";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings" };

/** Mirrors lib/db.ts: the embedded database is honoured only outside production. */
function usingEmbeddedDatabase(): boolean {
  return process.env.ACEVA_LOCAL_DB === "1" && process.env.NODE_ENV !== "production";
}

async function gatherDatabaseFacts(): Promise<DatabaseFacts> {
  const configured = isDatabaseConfigured();
  const base = { configured, embedded: usingEmbeddedDatabase() };
  if (!configured) {
    return { ...base, reachable: null, tablesCreated: null, tablesMissing: null, documents: null, files: null };
  }
  return { ...base, ...(await probeDatabase()) };
}

export default async function AdminSettingsPage() {
  await requireAdminPage(ADMIN_ROUTES.settings);

  // The pass key is read for its LENGTH only. The string never leaves this expression, so it cannot be rendered.
  const passkeyLength = getAdminPasskey()?.length ?? null;

  const facts: HealthFacts = {
    passkeyLength,
    minPasskeyLength: MIN_PASSKEY_LENGTH,
    sessionSeconds: getSessionTtlSeconds(),
    sessionSecretConfigured: getSessionSecret() !== null,
    allowedHosts: getAllowedAdminHosts(),
    uploadBytes: getMaxUploadBytes(),
    database: await gatherDatabaseFacts(),
    siteUrl: SITE_URL,
    siteUrlFromEnvironment: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    production: process.env.NODE_ENV === "production",
  };

  const checks = buildHealthChecks(facts);
  const summary = summarizeHealth(checks);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Health check"
        lede="How the console is configured, at a glance. This page only reads: secrets are never shown, only whether they are set and how strong they are."
      />

      <div className={cx(ui.stackLg, ui.stagger)}>
        <Panel title="Checklist" eyebrow="Read only">
          <HealthBanner summary={summary} />
          <HealthChecklist checks={checks} />
        </Panel>

        <Panel title="Sign out of this device" eyebrow="This browser">
          <p className={s.quickLead}>
            Ends the session in this browser right now. Other devices stay signed in until their session runs out; changing the pass key signs every device out at once.
          </p>
          <SignOutButton variant="button" />
        </Panel>
      </div>
    </>
  );
}
