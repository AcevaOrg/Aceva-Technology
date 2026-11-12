import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminStyles as ui, EmptyState, PageHeader, Panel, StatTile } from "@/components/admin";
import { cx } from "@/components/admin/utils";
import { DailyBars } from "@/components/admin/pages/DailyBars";
import {
  loadDailyLookups,
  loadLookupLog,
  logLoadFailure,
  type LookupLogPage,
} from "@/components/admin/pages/data";
import { clip, formatCount, plural } from "@/components/admin/pages/format";
import type { RawSearchParams } from "@/components/admin/pages/listQuery";
import { NavSelect } from "@/components/admin/pages/NavSelect";
import { DatabaseUnavailable, SetupNotice } from "@/components/admin/pages/Notices";
import s from "@/components/admin/pages/pages.module.css";
import { Pagination } from "@/components/admin/pages/Pagination";
import { CodesTable, LookupLog } from "@/components/admin/pages/VerificationPanels";
import {
  DAILY_WINDOW_DAYS,
  RESULT_FILTERS,
  parseVerificationQuery,
  summariseDaily,
  verificationHref,
} from "@/components/admin/pages/verificationView";
import { requireAdminPage } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { getDashboardStats, listDocuments, listVerificationEvents } from "@/lib/documents/store";
import { ADMIN_ROUTES } from "@/lib/nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Verification" };

const HEADER = {
  eyebrow: "Verification",
  title: "Lookups and codes",
  lede: "Every scan of a QR code, and every code typed on the verify page, leaves a line here. The codes you have issued are listed below with shortcuts to share or print them.",
} as const;

/** The codes table shows this many records; the page says so when there are more. */
const CODES_LIMIT = 200;

export default async function AdminVerificationPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const query = parseVerificationQuery(await searchParams);
  const here = verificationHref(query, { page: query.page });
  await requireAdminPage(here);

  if (!isDatabaseConfigured()) {
    return (
      <>
        <PageHeader {...HEADER} />
        <SetupNotice />
      </>
    );
  }

  const now = new Date();
  let codes: Awaited<ReturnType<typeof listDocuments>>;
  let log: LookupLogPage;
  let allTime: number;
  let daily: Awaited<ReturnType<typeof loadDailyLookups>> | null;
  let stats: Awaited<ReturnType<typeof getDashboardStats>> | null;
  try {
    [codes, log, allTime, daily, stats] = await Promise.all([
      listDocuments({ verifiable: true, limit: CODES_LIMIT, sort: "updated" }),
      loadLookupLog(query),
      listVerificationEvents({ limit: 1 }).then((result) => result.total),
      // The chart and the headline numbers are extras: the log and the codes still work without them.
      loadDailyLookups(now, query.doc ?? undefined).catch((error: unknown) => {
        logLoadFailure("verification-daily", error);
        return null;
      }),
      getDashboardStats().catch(() => null),
    ]);
  } catch (error) {
    logLoadFailure("verification", error);
    return (
      <>
        <PageHeader {...HEADER} />
        <DatabaseUnavailable retryHref={here} />
      </>
    );
  }

  const { pagination } = log;
  if (pagination.total > 0 && pagination.clamped) redirect(verificationHref(query, { page: pagination.page }));

  const nowMs = now.getTime();
  const filtered = query.result !== null || query.doc !== null;
  const dayTotals = daily ? summariseDaily(daily.points) : null;

  const recordOptions = [
    { value: "", label: "All records", href: verificationHref(query, { doc: null }) },
    ...codes.items.map((record) => ({ value: record.id, label: clip(record.title, 64), href: verificationHref(query, { doc: record.id }) })),
  ];
  if (query.doc && !recordOptions.some((option) => option.value === query.doc)) {
    recordOptions.push({ value: query.doc, label: "Selected record", href: verificationHref(query, { doc: query.doc }) });
  }
  const selectedRecord = query.doc ? codes.items.find((record) => record.id === query.doc) : undefined;

  return (
    <>
      <PageHeader {...HEADER} />

      <div className={cx(ui.stackLg, ui.stagger)}>
        <section aria-label="At a glance">
          <div className={s.tiles}>
            <StatTile label="Lookups, all time" value={allTime} hint="Every result, including not found" />
            <StatTile label="Last 7 days" value={stats?.verifications7d ?? 0} hint={stats ? "QR scans and typed codes" : "Unavailable just now"} />
            <StatTile label="Last 30 days" value={stats?.verifications30d ?? 0} hint={stats ? "QR scans and typed codes" : "Unavailable just now"} />
            <StatTile label="Codes issued" value={codes.total} hint="Records with a QR code" />
          </div>
        </section>

        <Panel
          title="Daily totals"
          eyebrow={`Last ${DAILY_WINDOW_DAYS} days${selectedRecord ? `, ${clip(selectedRecord.title, 40)}` : ""}`}
        >
          {daily ? (
            <>
              <DailyBars points={daily.points} />
              <p className={s.panelNote}>
                {dayTotals && dayTotals.total > 0
                  ? `${formatCount(dayTotals.total)}${daily.truncated ? "+" : ""} ${plural(dayTotals.total, "lookup")} in ${DAILY_WINDOW_DAYS} days. Days are counted in UTC.`
                  : `No lookups in the last ${DAILY_WINDOW_DAYS} days. Days are counted in UTC.`}
              </p>
            </>
          ) : (
            <p className={s.panelNote}>The daily totals could not be read just now. Refresh to try again.</p>
          )}
        </Panel>

        <Panel title="Lookup log" eyebrow="Newest first">
          <div className={ui.toolbar}>
            <div className={s.filterGroup} role="group" aria-label="Filter by result">
              <span className={s.fieldCaption}>Result</span>
              <div className={ui.chips}>
                <Link
                  href={verificationHref(query, { result: null })}
                  prefetch={false}
                  className={ui.chip}
                  data-active={query.result === null ? "" : undefined}
                  aria-current={query.result === null ? "true" : undefined}
                >
                  Any
                </Link>
                {RESULT_FILTERS.map((filter) => {
                  const active = query.result === filter.value;
                  return (
                    <Link
                      key={filter.value}
                      href={verificationHref(query, { result: active ? null : filter.value })}
                      prefetch={false}
                      className={ui.chip}
                      data-active={active ? "" : undefined}
                      aria-current={active ? "true" : undefined}
                    >
                      {filter.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <NavSelect id="verification-record" label="Record" value={query.doc ?? ""} options={recordOptions} />
          </div>

          {log.events.length > 0 ? (
            <>
              <LookupLog events={log.events} nowMs={nowMs} />
              <Pagination pagination={pagination} hrefFor={(page) => verificationHref(query, { page })} noun="lookup" />
              {log.truncated ? (
                <p className={s.panelNote}>Filtering by result reads the newest 1,000 lookups, so older matches may not be listed.</p>
              ) : null}
            </>
          ) : (
            <EmptyState
              title={filtered ? "No lookups match" : "No lookups yet"}
              body={
                filtered
                  ? "Nothing in the log matches this result and record. Clear a filter to see more."
                  : "When someone scans a QR code or types a code on the verify page, it will appear here."
              }
              action={
                filtered ? (
                  <Link href={ADMIN_ROUTES.verification} className={ui.link}>
                    Clear filters
                  </Link>
                ) : undefined
              }
            />
          )}
        </Panel>

        <Panel title="Verification codes" eyebrow={`${formatCount(codes.total)} ${plural(codes.total, "code")} issued`}>
          {codes.items.length > 0 ? (
            <>
              <CodesTable records={codes.items} now={now} />
              {codes.total > codes.items.length ? (
                <p className={s.panelNote}>
                  Showing the {formatCount(codes.items.length)} most recently updated of {formatCount(codes.total)}. Open a document to reach the others.
                </p>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="No codes issued yet"
              body="Certifications, team profiles and experience letters get a verification code automatically. Add one and its QR code will be listed here."
            />
          )}
        </Panel>
      </div>
    </>
  );
}
