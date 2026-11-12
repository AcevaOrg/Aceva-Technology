import { adminStyles as ui, AdminStatSkeleton, AdminTableSkeleton } from "@/components/admin";

/**
 * The loading skeleton behind each console page's loading.tsx. It sketches the page's real shape
 * (headline, optional stat tiles, optional filter row, ruled rows) so the content settles in without a
 * jump. Server-only, no JavaScript, and announced to assistive tech once.
 */

interface PageLoadingProps {
  /** Placeholder stat tiles; 0 for none. */
  stats?: number;
  /** A row of filter-shaped placeholders above the list. */
  filters?: boolean;
  /** Placeholder ledger rows; 0 for none. */
  rows?: number;
  label?: string;
}

export function PageLoading({ stats = 0, filters = false, rows = 6, label = "Loading" }: PageLoadingProps) {
  return (
    <div role="status" aria-busy="true">
      <span className={ui.srOnly}>{label}</span>
      <div aria-hidden="true">
        <div className={ui.pageHead}>
          <div className={ui.pageHeadMain}>
            <span className={`${ui.skel} ${ui.skelLine}`} style={{ width: 140, height: 11 }} />
            <span className={`${ui.skel} ${ui.skelTitle}`} style={{ marginTop: 22 }} />
            <span className={`${ui.skel} ${ui.skelLine}`} style={{ marginTop: 20, width: "min(420px, 78%)" }} />
          </div>
        </div>
        <div className={ui.stackLg}>
          {stats > 0 ? <AdminStatSkeleton count={stats} announce={false} /> : null}
          {filters ? (
            <div className={ui.stack}>
              <span className={`${ui.skel} ${ui.skelBlock}`} />
              <span className={`${ui.skel} ${ui.skelBlock}`} style={{ width: "min(640px, 100%)" }} />
            </div>
          ) : null}
          {rows > 0 ? <AdminTableSkeleton rows={rows} announce={false} /> : null}
        </div>
      </div>
    </div>
  );
}
