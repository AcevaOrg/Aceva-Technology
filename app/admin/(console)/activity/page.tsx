import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminStyles as ui, EmptyState, PageHeader, Panel } from "@/components/admin";
import { AuditLedger } from "@/components/admin/pages/AuditLedger";
import {
  ACTIVITY_PAGE_SIZE,
  actionOptionsFor,
  activityHref,
  activityPagination,
  parseActivityQuery,
} from "@/components/admin/pages/auditSummary";
import { logLoadFailure } from "@/components/admin/pages/data";
import { shortId } from "@/components/admin/pages/format";
import type { RawSearchParams } from "@/components/admin/pages/listQuery";
import { NavSelect } from "@/components/admin/pages/NavSelect";
import { DatabaseUnavailable, SetupNotice } from "@/components/admin/pages/Notices";
import s from "@/components/admin/pages/pages.module.css";
import { Pagination } from "@/components/admin/pages/Pagination";
import { listAdminEvents } from "@/lib/admin/audit";
import { requireAdminPage } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { ADMIN_ROUTES, adminDocumentRoute } from "@/lib/nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Activity" };

const HEADER = {
  eyebrow: "Activity",
  title: "What happened",
  lede: "A record of sign-ins and every change made to the registry: who did it (as a short device code, never a name or an address) and when.",
} as const;

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const query = parseActivityQuery(await searchParams);
  const here = activityHref(query, { page: query.page });
  await requireAdminPage(here);

  if (!isDatabaseConfigured()) {
    return (
      <>
        <PageHeader {...HEADER} />
        <SetupNotice />
      </>
    );
  }

  let result: Awaited<ReturnType<typeof listAdminEvents>>;
  try {
    result = await listAdminEvents({
      limit: ACTIVITY_PAGE_SIZE,
      offset: (query.page - 1) * ACTIVITY_PAGE_SIZE,
      action: query.action ?? undefined,
      entityId: query.entity ?? undefined,
    });
  } catch (error) {
    logLoadFailure("activity", error);
    return (
      <>
        <PageHeader {...HEADER} />
        <DatabaseUnavailable retryHref={here} />
      </>
    );
  }

  const pagination = activityPagination(result.total, query.page);
  if (result.total > 0 && pagination.clamped) redirect(activityHref(query, { page: pagination.page }));

  const nowMs = new Date().getTime();
  const filtered = query.action !== null || query.entity !== null;

  return (
    <>
      <PageHeader {...HEADER} />

      <Panel title="Audit trail" eyebrow="Newest first">
        <div className={ui.toolbar}>
          <NavSelect
            id="activity-action"
            label="Show"
            value={query.action ?? ""}
            options={actionOptionsFor(query.action).map((option) => ({
              ...option,
              href: activityHref(query, { action: option.value || null }),
            }))}
          />
          {query.entity ? (
            <p className={s.activeBar}>
              <span>
                One record only (<Link href={adminDocumentRoute(query.entity)} prefetch={false} className={ui.link}>{shortId(query.entity)}</Link>)
              </span>
              <Link href={activityHref(query, { entity: null })} prefetch={false} className={ui.link}>
                Show all records
              </Link>
            </p>
          ) : null}
        </div>

        {result.events.length > 0 ? (
          <>
            <AuditLedger events={result.events} nowMs={nowMs} />
            <Pagination pagination={pagination} hrefFor={(page) => activityHref(query, { page })} noun="event" />
          </>
        ) : (
          <EmptyState
            title={filtered ? "No matching activity" : "Nothing recorded yet"}
            body={
              filtered
                ? "No event matches this filter. Show all activity to see everything."
                : "Sign-ins and changes will appear here as soon as they happen."
            }
            action={
              filtered ? (
                <Link href={ADMIN_ROUTES.activity} className={ui.link}>
                  Show all activity
                </Link>
              ) : undefined
            }
          />
        )}
      </Panel>
    </>
  );
}
