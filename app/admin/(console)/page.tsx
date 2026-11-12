import type { Metadata } from "next";
import Link from "next/link";
import {
  adminStyles as ui,
  ButtonLink,
  EmptyState,
  PageHeader,
  Panel,
  PlusIcon,
  StatTile,
} from "@/components/admin";
import { cx } from "@/components/admin/utils";
import { AttentionList } from "@/components/admin/pages/AttentionList";
import { attentionTotal } from "@/components/admin/pages/attention";
import { loadDashboardData, logLoadFailure, type DashboardData } from "@/components/admin/pages/data";
import { formatCount, plural } from "@/components/admin/pages/format";
import { DatabaseUnavailable, SetupNotice } from "@/components/admin/pages/Notices";
import s from "@/components/admin/pages/pages.module.css";
import { QuickAdd } from "@/components/admin/pages/QuickAdd";
import { RecentLedger } from "@/components/admin/pages/RecentLedger";
import { SectionBars } from "@/components/admin/pages/SectionBars";
import { Sparkline } from "@/components/admin/pages/Sparkline";
import { DAILY_WINDOW_DAYS } from "@/components/admin/pages/verificationView";
import { requireAdminPage } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { EXPIRING_SOON_DAYS } from "@/lib/documents/store";
import { ADMIN_ROUTES } from "@/lib/nav";

// Reads the session cookie and the database on every request; nothing here can be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Overview" };

const HEADER = {
  eyebrow: "Overview",
  title: "Welcome back.",
  lede: "Where the document registry stands today: what is live, what is waiting, and what needs a decision.",
} as const;

function NewDocumentButton() {
  return (
    <ButtonLink href={ADMIN_ROUTES.newDocument} iconLeading={<PlusIcon />}>
      New document
    </ButtonLink>
  );
}

export default async function AdminDashboardPage() {
  // Layouts do not re-render on client navigation, so the page checks the session itself.
  await requireAdminPage(ADMIN_ROUTES.root);

  if (!isDatabaseConfigured()) {
    return (
      <>
        <PageHeader {...HEADER} />
        <SetupNotice />
      </>
    );
  }

  const now = new Date();
  let data: DashboardData;
  try {
    data = await loadDashboardData(now);
  } catch (error) {
    logLoadFailure("dashboard", error);
    return (
      <>
        <PageHeader {...HEADER} />
        <DatabaseUnavailable retryHref={ADMIN_ROUTES.root} />
      </>
    );
  }

  const { stats, attention, attentionComplete, daily } = data;
  const needs = attentionTotal(attention);

  return (
    <>
      <PageHeader
        {...HEADER}
        actions={
          <>
            <ButtonLink href={ADMIN_ROUTES.documents} variant="ghost">
              All documents
            </ButtonLink>
            <NewDocumentButton />
          </>
        }
      />

      <div className={cx(ui.stackLg, ui.stagger)}>
        <section aria-label="At a glance">
          <div className={s.tiles}>
            <StatTile label="Total documents" value={stats.totals.total} hint={`${formatCount(stats.totals.archived)} archived`} />
            <StatTile label="Published" value={stats.totals.published} tone="success" hint="Live, subject to visibility" />
            <StatTile label="Drafts" value={stats.totals.draft} hint="Private until published" />
            <StatTile
              label={`Expiring in ${EXPIRING_SOON_DAYS} days`}
              value={stats.expiringSoon}
              tone={stats.expiringSoon > 0 ? "warning" : "default"}
              hint="Not yet expired, not archived"
            />
            <StatTile label="Revoked" value={stats.revoked} tone={stats.revoked > 0 ? "danger" : "default"} hint="Withdrawn, still on record" />
            <StatTile label="Expired" value={stats.expired} tone={stats.expired > 0 ? "warning" : "default"} hint="Past their expiry date" />
            <StatTile label="Lookups, last 7 days" value={stats.verifications7d} hint="QR scans and typed codes" />
            <StatTile label="Lookups, last 30 days" value={stats.verifications30d} hint="All verification results" />
          </div>
        </section>

        <Panel title="Quick add" eyebrow="Start a record">
          <QuickAdd />
        </Panel>

        <div className={s.dash}>
          <div className={s.col}>
            <Panel
              title="By section"
              eyebrow="The registry"
              actions={
                <ButtonLink href={ADMIN_ROUTES.documents} variant="quiet" size="sm">
                  Open list
                </ButtonLink>
              }
            >
              <SectionBars byCategory={stats.byCategory} />
            </Panel>

            <Panel
              title="Recently updated"
              eyebrow="Latest changes"
              actions={
                <ButtonLink href={ADMIN_ROUTES.activity} variant="quiet" size="sm">
                  Activity log
                </ButtonLink>
              }
            >
              {stats.recentlyUpdated.length > 0 ? (
                <RecentLedger records={stats.recentlyUpdated} nowMs={now.getTime()} />
              ) : (
                <EmptyState
                  title="Nothing here yet"
                  body="Records you create or edit will show up here, newest first."
                  action={
                    <ButtonLink href={ADMIN_ROUTES.newDocument} iconLeading={<PlusIcon />}>
                      Add the first document
                    </ButtonLink>
                  }
                />
              )}
            </Panel>
          </div>

          <div className={s.col}>
            <Panel
              title="Needs attention"
              eyebrow={needs > 0 ? `${formatCount(needs)} ${plural(needs, "item")}` : "Nothing urgent"}
            >
              <AttentionList groups={attention} incomplete={!attentionComplete} />
            </Panel>

            <Panel
              title="Verification lookups"
              eyebrow={`Last ${DAILY_WINDOW_DAYS} days`}
              actions={
                <ButtonLink href={ADMIN_ROUTES.verification} variant="quiet" size="sm">
                  Open log
                </ButtonLink>
              }
            >
              {daily ? (
                <Sparkline points={daily.points} noun="lookup" truncated={daily.truncated} />
              ) : (
                <p className={s.panelNote}>The lookup history could not be read just now. Refresh to try again.</p>
              )}
              {daily?.truncated ? (
                <p className={s.panelNote}>
                  Very busy: only the most recent lookups were counted, so these figures are a minimum.{" "}
                  <Link href={ADMIN_ROUTES.verification} className={ui.link}>
                    See the log
                  </Link>
                </p>
              ) : null}
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
