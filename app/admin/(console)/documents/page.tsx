import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink, EmptyState, PageHeader, PlusIcon } from "@/components/admin";
import { logLoadFailure } from "@/components/admin/pages/data";
import { DocumentsLedger } from "@/components/admin/pages/DocumentsLedger";
import { FilterBar } from "@/components/admin/pages/FilterBar";
import {
  activeFilterCount,
  describeEmptyList,
  listHref,
  paginate,
  parseListQuery,
  toListFilters,
  type RawSearchParams,
} from "@/components/admin/pages/listQuery";
import { DatabaseUnavailable, SetupNotice } from "@/components/admin/pages/Notices";
import { Pagination } from "@/components/admin/pages/Pagination";
import { buildLedgerRow } from "@/components/admin/pages/rowModel";
import { requireAdminPage } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/documents/categories";
import { EXPIRING_SOON_DAYS, getDashboardStats, listDocuments } from "@/lib/documents/store";
import type { DocumentCategory } from "@/lib/documents/types";
import { ADMIN_ROUTES } from "@/lib/nav";

// Filters live in the URL and the data in the database: every request is its own render.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Documents" };

export default async function AdminDocumentsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  // searchParams is async in Next 16.
  const query = parseListQuery(await searchParams);
  const here = listHref(query, { page: query.page });
  await requireAdminPage(here);

  const spec = query.category ? CATEGORIES[query.category] : null;
  const header = {
    eyebrow: "Documents",
    title: spec ? spec.plural : "All documents",
    lede: spec ? spec.adminHelp : "Every record in the registry: reports, certificates, team profiles and letters. Filter, search and act on them from here.",
  };
  const newHref = spec ? `${ADMIN_ROUTES.newDocument}?category=${spec.slug}` : ADMIN_ROUTES.newDocument;
  const actions = (
    <ButtonLink href={newHref} iconLeading={<PlusIcon />}>
      New document
    </ButtonLink>
  );

  if (!isDatabaseConfigured()) {
    return (
      <>
        <PageHeader {...header} actions={actions} />
        <SetupNotice />
      </>
    );
  }

  let result: Awaited<ReturnType<typeof listDocuments>>;
  let stats: Awaited<ReturnType<typeof getDashboardStats>> | null;
  try {
    [result, stats] = await Promise.all([
      listDocuments(toListFilters(query, EXPIRING_SOON_DAYS)),
      // The tab counts are a nicety: if they cannot load, the tabs still work without numbers.
      getDashboardStats().catch(() => null),
    ]);
  } catch (error) {
    logLoadFailure("documents", error);
    return (
      <>
        <PageHeader {...header} actions={actions} />
        <DatabaseUnavailable retryHref={here} />
      </>
    );
  }

  const pagination = paginate(result.total, query.page);
  // A page past the end (after deleting the last row of the last page, or a stale link) goes to the last real page.
  if (result.total > 0 && pagination.clamped) redirect(listHref(query, { page: pagination.page }));

  const now = new Date();
  const rows = result.items.map((record) => buildLedgerRow(record, now, EXPIRING_SOON_DAYS));
  const categoryCounts = stats
    ? (Object.fromEntries(CATEGORY_LIST.map((item) => [item.key, stats.byCategory[item.key].total])) as Record<DocumentCategory, number>)
    : null;
  const empty = describeEmptyList(query, EXPIRING_SOON_DAYS);

  return (
    <>
      <PageHeader {...header} actions={actions} />

      <FilterBar query={query} categoryCounts={categoryCounts} totalCount={stats?.totals.total ?? null} expiringDays={EXPIRING_SOON_DAYS} />

      {rows.length > 0 ? (
        <>
          <DocumentsLedger rows={rows} />
          <Pagination pagination={pagination} hrefFor={(page) => listHref(query, { page })} noun="document" />
        </>
      ) : (
        <EmptyState
          title={empty.title}
          body={empty.body}
          action={
            empty.action ? (
              <ButtonLink href={empty.action.href} variant={activeFilterCount(query) > 0 ? "ghost" : "primary"}>
                {empty.action.label}
              </ButtonLink>
            ) : undefined
          }
        />
      )}
    </>
  );
}
