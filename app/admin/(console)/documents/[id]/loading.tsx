import ui from "@/components/admin/admin.module.css";
import { AdminFormSkeleton } from "@/components/admin/Skeletons";

/** Shown while the editor page streams in: the page head, the form, and the preview column. Server-only. */
export default function EditDocumentLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className={ui.srOnly}>Loading the document</span>
      <div aria-hidden="true">
        <div className={ui.pageHead}>
          <div className={ui.pageHeadMain}>
            <span className={`${ui.skel} ${ui.skelLine}`} style={{ width: 160, height: 11 }} />
            <span className={`${ui.skel} ${ui.skelTitle}`} style={{ marginTop: 22 }} />
            <span className={`${ui.skel} ${ui.skelLine}`} style={{ marginTop: 20, width: "min(420px, 70%)" }} />
          </div>
        </div>
        <div className={ui.split}>
          <AdminFormSkeleton announce={false} fields={8} />
          <div className={ui.splitAside}>
            <span className={`${ui.skel} ${ui.skelStat}`} style={{ height: 300 }} />
            <span className={`${ui.skel} ${ui.skelStat}`} style={{ height: 240 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
