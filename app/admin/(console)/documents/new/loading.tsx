import ui from "@/components/admin/admin.module.css";
import { AdminFormSkeleton } from "@/components/admin/Skeletons";

/** Shown while the new-document page streams in: the page head and the first block of the form. Server-only. */
export default function NewDocumentLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className={ui.srOnly}>Loading the new document form</span>
      <div aria-hidden="true">
        <div className={ui.pageHead}>
          <div className={ui.pageHeadMain}>
            <span className={`${ui.skel} ${ui.skelLine}`} style={{ width: 140, height: 11 }} />
            <span className={`${ui.skel} ${ui.skelTitle}`} style={{ marginTop: 22 }} />
            <span className={`${ui.skel} ${ui.skelLine}`} style={{ marginTop: 20, width: "min(480px, 80%)" }} />
          </div>
        </div>
        <AdminFormSkeleton announce={false} fields={6} />
      </div>
    </div>
  );
}
