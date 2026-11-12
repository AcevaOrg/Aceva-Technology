import s from "@/components/admin/admin.module.css";
import { AdminStatSkeleton, AdminTableSkeleton } from "@/components/admin/Skeletons";

/**
 * Shown while a console page streams in. It sketches the common page shape (headline, stat tiles, a ruled
 * list) so the real page settles in without a jump. Server-only, no JavaScript.
 */
export default function ConsoleLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className={s.srOnly}>Loading</span>
      <div aria-hidden="true">
        <div className={s.pageHead}>
          <div className={s.pageHeadMain}>
            <span className={`${s.skel} ${s.skelLine}`} style={{ width: 160, height: 11 }} />
            <span className={`${s.skel} ${s.skelTitle}`} style={{ marginTop: 22 }} />
            <span className={`${s.skel} ${s.skelLine}`} style={{ marginTop: 20, width: "min(460px, 80%)" }} />
          </div>
        </div>
        <div className={s.stackLg}>
          <AdminStatSkeleton announce={false} />
          <AdminTableSkeleton announce={false} />
        </div>
      </div>
    </div>
  );
}
